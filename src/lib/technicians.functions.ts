import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { rankTechniciansByDeclaredArea } from "@/lib/technician-local-ranking";
import { collectPublicDirectoryPages, publicDirectoryPage } from "@/lib/public-directory-pagination";
import { automaticRegionalRankingArea, parseVercelRegion } from "@/lib/regional-suggestion";
import { isValidTechnicianId, isValidTechnicianSlug } from "@/lib/technician-id";
import { sanitizePublicTechnician } from "@/lib/public-profile-text";
import { readPublicEligibleRows, type PublicEligibilityRpc } from "@/lib/public-eligibility";
import { technicianOperationsSchema, type TechnicianOperations } from "@/lib/technician-operations-contract";

export type PublicTechnician = {
  id: string;
  public_slug: string;
  display_name: string;
  specialties: string[];
  service_slugs: string[];
  state_uf: string | null;
  neighborhood: string | null;
  city: string;
  region: string | null;
  bio: string | null;
  avatar_path: string | null;
  service_radius_km: number | null;
  coverage_city_ids: number[];
  coverage_cities?: Array<{ id: number; name: string; uf: string }>;
  operations?: TechnicianOperations | null;
  covers_entire_state?: boolean;
  online_now: boolean;
  pioneer_bronze?: boolean;
  referral_highlight?: boolean;
};

const COLUMNS = "id, public_slug, display_name, specialties, service_slugs, city, state_uf, neighborhood, region, bio, avatar_path, service_radius_km, coverage_city_ids";
const PUBLIC_BATCH = 500;
const ADMIN_BATCH = 200; // The existing public admin RPC caps _limit at 200.
const DIRECTORY_CEILING = 50_000;
const ENRICHMENT_BATCH = 250;

function batches<T>(items: readonly T[], size = ENRICHMENT_BATCH): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}

async function mapBatches<T, U>(items: readonly T[], read: (part: T[]) => Promise<U>): Promise<U[]> {
  const groups = batches(items);
  const results: U[] = [];
  // Modest concurrency keeps nationwide directories from making thousands of
  // sequential calls, without flooding the shared public Supabase project.
  for (let index = 0; index < groups.length; index += 4) {
    results.push(...await Promise.all(groups.slice(index, index + 4).map(read)));
  }
  return results;
}

// Owner-authorized technicians can be listed without creating fake Auth accounts.
// The database RPC exposes public fields only and checks private moderation state.
const adminPublicRow = z.object({
  id: z.string().uuid(),
  public_slug: z.string().regex(/^tecnico-[a-f0-9]{32}$/),
  display_name: z.string().min(3).max(120),
  specialties: z.array(z.string()),
  service_slugs: z.array(z.string()),
  city: z.string(),
  state_uf: z.string().nullable(),
  covers_entire_state: z.boolean(),
  neighborhood: z.string().nullable(),
  region: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_path: z.string().nullable(),
  service_radius_km: z.number().nullable(),
  coverage_city_ids: z.array(z.number().int()),
});

async function listAdminPublished(filters: {
  slug?: string | undefined; category?: string | undefined; service?: string | undefined;
  uf?: string | undefined; city?: string | undefined; region?: string | undefined;
  neighborhood?: string | undefined; offset?: number; limit?: number;
  hydrateCoverage?: boolean;
}): Promise<PublicTechnician[]> {
  // No neighborhood was supplied for these imports; never invent a match.
  if (filters.neighborhood) return [];
  const { data, error } = await (publicClient() as unknown as SupabaseClient).rpc(
    "eut_public_admin_technicians", {
      _slug: filters.slug ?? null,
      _category: filters.category ?? null,
      _service: filters.service ?? null,
      _uf: filters.uf ?? null,
      _city: filters.city ?? null,
      _region: filters.region ?? null,
      _limit: filters.slug ? 1 : filters.limit ?? 200,
      _offset: filters.slug ? 0 : filters.offset ?? 0,
    },
  );
  if (error) throw new Error("Não foi possível consultar o catálogo de técnicos.");
  const rows = z.array(adminPublicRow).parse(data);
  const sanitized = rows.map((r) => ({
    ...sanitizePublicTechnician(r),
    online_now: false,
    pioneer_bronze: false,
    referral_highlight: false,
  }));
  return filters.hydrateCoverage === false ? sanitized : withCoverageCities(sanitized);
}

// Links e classificação por IA anteriores usavam rótulos, não identificadores.
const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  "Ar-condicionado": "climatizacao",
  "Automação": "automacao",
  CFTV: "cftv",
  Computador: "computadores",
  Comunicações: "comunicacoes",
  Elétrica: "eletrica",
  Gráfica: "design-grafico",
  Impressora: "impressoras",
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h, cache: "no-store" });
      },
    },
  });
}

async function withOnlineStatus(
  rows: Array<Omit<PublicTechnician, "online_now">>,
): Promise<PublicTechnician[]> {
  if (!rows.length) return [];
  try {
    // Anonymous access is limited to online signals for these already-public IDs.
    const dataSets = await mapBatches(rows.map(row => row.id), async (ids) => {
      const { data, error } = await (publicClient() as unknown as SupabaseClient)
        .rpc("eut_online_published_ids", { _technician_ids: ids });
      if (error) throw error;
      return Array.isArray(data) ? data as Array<{ technician_id: string }> : [];
    });
    const onlineIds = new Set(dataSets.flat().map(item => item.technician_id));
    return rows.map((row) => ({
      ...row,
      online_now: onlineIds.has(row.id),
    })).sort((a, b) => Number(b.online_now) - Number(a.online_now));
  } catch {
    // Never claim a technician is online if a presence lookup fails.
    return rows.map((row) => ({ ...row, online_now: false }));
  }
}

/** Only public approved technician IDs, never pre-registration identities. */
async function withPioneerBadges(rows: PublicTechnician[]): Promise<PublicTechnician[]> {
  if (!rows.length) return [];
  try {
    const dataSets = await mapBatches(rows.map(row => row.id), async (group) => {
      const { data, error } = await (publicClient() as unknown as SupabaseClient)
        .from("eut_pioneer_badges").select("technician_id").in("technician_id", group);
      if (error) throw error;
      return Array.isArray(data) ? data as Array<{ technician_id: string }> : [];
    });
    const ids = new Set(dataSets.flat().map(badge => badge.technician_id));
    return rows.map((row) => ({ ...row, pioneer_bronze: ids.has(row.id) }));
  } catch {
    return rows.map((row) => ({ ...row, pioneer_bronze: false }));
  }
}

/** Anonymous lookup returns only public approved IDs; never referral identities. */
async function withReferralHighlights(rows: PublicTechnician[]): Promise<PublicTechnician[]> {
  if (!rows.length) return [];
  try {
    const dataSets = await mapBatches(rows.map(row => row.id), async (ids) => {
      const { data, error } = await (publicClient() as unknown as SupabaseClient)
        .rpc("eut_public_referral_highlights", { _technician_ids: ids });
      if (error) throw error;
      return Array.isArray(data) ? data as Array<{ technician_id: string }> : [];
    });
    const highlighted = new Set(dataSets.flat().map(record => record.technician_id));
    return rows.map((row) => ({ ...row, referral_highlight: highlighted.has(row.id) }));
  } catch {
    // A backend outage never grants an unverified spotlight.
    return rows.map((row) => ({ ...row, referral_highlight: false }));
  }
}

/** Expand only catalog-backed municipality labels, never private addresses or GPS. */
async function withCoverageCities(rows: PublicTechnician[]): Promise<PublicTechnician[]> {
  const codes = [...new Set(rows.flatMap((t) => t.coverage_city_ids ?? []))];
  if (!codes.length) return rows.map((row) => ({ ...row, coverage_cities: [] }));
  try {
    const dataSets = await mapBatches(codes, async (ids) => {
      const { data, error } = await (publicClient() as unknown as SupabaseClient)
        .from("eut_ibge_municipalities").select("id,name,uf").in("id", ids);
      if (error) throw error;
      return Array.isArray(data) ? data as Array<{ id: number; name: string; uf: string }> : [];
    });
    const byCode = new Map(dataSets.flat().map(city => [city.id, city] as const));
    return rows.map((row) => ({
      ...row,
      coverage_cities: (row.coverage_city_ids ?? []).flatMap((id) => {
        const city = byCode.get(id);
        return city ? [city] : [];
      }),
    }));
  } catch {
    // No guesswork when the official catalog is inaccessible.
    return rows.map((row) => ({ ...row, coverage_cities: [] }));
  }
}

// Strip characters that would break PostgREST ilike filters.
const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);

export const listApprovedTechnicians = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ especialidade: z.string().max(80), cidade: z.string().max(80), regiao: z.string().max(80), servico: z.string().max(80).default(""), uf: z.string().max(2).default(""), bairro: z.string().max(80).default(""), prioridade: z.string().max(12).default(""), pagina: z.number().int().min(1).max(1000).default(1) }).parse(d),
  )
  .handler(async ({ data }): Promise<PublicTechnician[]> => {
    setResponseHeader("Cache-Control", "no-store");
    // "Priorizar minha região" is not a strict geography filter. It ranks
    // among approved matching professionals so other regions remain options.
    const regionalPriority = data.prioridade === "regiao" && Boolean(data.uf || data.cidade.trim());
    const offset = (data.pagina - 1) * 100;
    const category = data.especialidade && data.especialidade !== "Todas"
      ? (LEGACY_CATEGORY_ALIASES[data.especialidade] ?? data.especialidade) : undefined;
    if (data.especialidade && data.especialidade !== "Todas") {
      const slug = category!;
      const { data: active, error: catalogError } = await (publicClient() as unknown as SupabaseClient)
        .from("eut_service_categories").select("slug").eq("slug", slug).eq("active", true).maybeSingle();
      if (catalogError) throw new Error("Não foi possível validar a categoria selecionada.");
      if (!active) return [];
    }
    if (data.servico) {
      const { data: offered, error: serviceError } = await (publicClient() as unknown as SupabaseClient)
        .from("eut_service_types").select("slug,category_slug").eq("slug", data.servico).eq("active", true).maybeSingle();
      if (serviceError) throw new Error("Não foi possível validar o serviço escolhido.");
      if (!offered) return [];
      if (data.especialidade && data.especialidade !== "Todas" && (LEGACY_CATEGORY_ALIASES[data.especialidade] ?? data.especialidade) !== offered.category_slug) return [];
    }
    const uf = data.uf.toUpperCase();
    if (uf) {
      if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)) return [];
    }
    const bairro = clean(data.bairro);
    const city = clean(data.cidade);
    const region = clean(data.regiao);
    let rankingArea: { uf: string; cidade: string; bairro: string } | null = regionalPriority
      ? { uf, cidade: data.cidade, bairro: data.bairro } : null;
    if (!regionalPriority && data.prioridade !== "nacional") {
      const approximateArea = automaticRegionalRankingArea(data, parseVercelRegion({
        country: getRequestHeader("x-vercel-ip-country") ?? null,
        state: getRequestHeader("x-vercel-ip-country-region") ?? null,
        city: getRequestHeader("x-vercel-ip-city") ?? null,
      }));
      if (approximateArea) {
        try {
          // Trust the coarse IP city only when it exists in the IBGE catalog.
          const { data: municipality, error: catalogError } = await (publicClient() as unknown as SupabaseClient)
            .from("eut_ibge_municipalities").select("id")
            .eq("uf", approximateArea.uf).ilike("name", approximateArea.cidade).limit(1);
          if (!catalogError && municipality?.length) rankingArea = approximateArea;
        } catch { /* The absence of an official match must not create a location. */ }
      }
    }
    // A normal, unambiguous city search must also find declared covered cities,
    // rather than filtering eligible technicians solely by their base city.
    // Advanced neighborhood/region filters retain their existing semantics.
    const cityCoverageSearch = !regionalPriority && Boolean(city) && !bairro && !region;
    const coverageCityIds: number[] = [];
    if (cityCoverageSearch) {
      let municipalities = publicClient().from("eut_ibge_municipalities")
        .select("id").ilike("name", `%${city}%`);
      if (uf) municipalities = municipalities.eq("uf", uf);
      const { data: locations, error: municipalityError } = await municipalities.limit(100);
      if (municipalityError) throw new Error("Não foi possível consultar os municípios atendidos.");
      for (const location of locations ?? []) {
        if (Number.isInteger(location.id)) coverageCityIds.push(location.id);
      }
    }
    const globalRanking = rankingArea !== null || cityCoverageSearch;
    const loadApprovedPage = async (pageOffset: number, limit: number) => {
      let q = publicClient().from("technicians").select(COLUMNS)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
      if (category) q = q.contains("specialties", [category]);
      if (data.servico) q = q.contains("service_slugs", [data.servico]);
      if (!regionalPriority && uf) q = q.eq("state_uf", uf);
      if (!regionalPriority && bairro) q = q.ilike("neighborhood", `%${bairro}%`);
      if (!regionalPriority && city) q = q.ilike("city", `%${city}%`);
      if (!regionalPriority && region) q = q.ilike("region", `%${region}%`);
      const { data: rows, error } = await q.range(pageOffset, pageOffset + limit - 1);
      if (error) {
        console.error("listApprovedTechnicians", error);
        throw new Error("Não foi possível carregar os técnicos.");
      }
      return rows ?? [];
    };
    // A municipality may be covered by someone based in another city or UF.
    // Query coverage IDs in the database, not by scanning the national catalog.
    const loadCoveragePage = async (pageOffset: number, limit: number) => {
      if (!coverageCityIds.length) return [];
      let q = publicClient().from("technicians").select(COLUMNS)
        .eq("status", "aprovado")
        .overlaps("coverage_city_ids", coverageCityIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
      if (category) q = q.contains("specialties", [category]);
      if (data.servico) q = q.contains("service_slugs", [data.servico]);
      const { data: rows, error } = await q.range(pageOffset, pageOffset + limit - 1);
      if (error) throw new Error("Não foi possível consultar a cobertura municipal.");
      return rows ?? [];
    };
    // With a regional hint or explicit city search, a pre-paginated slice
    // can hide matching technicians. Combine eligible sources before paging.
    const adminFilters = {
      ...(category ? { category } : {}),
      ...(data.servico ? { service: data.servico } : {}),
      ...(!regionalPriority && uf ? { uf } : {}),
      ...(!regionalPriority && city ? { city } : {}),
      ...(!regionalPriority && region ? { region } : {}),
      ...(!regionalPriority && bairro ? { neighborhood: bairro } : {}),
    };
    const [rows, adminPublished, coveredRows] = await Promise.all([
      globalRanking
        ? collectPublicDirectoryPages(loadApprovedPage, PUBLIC_BATCH, DIRECTORY_CEILING)
        : loadApprovedPage(offset, 100),
      globalRanking
        ? collectPublicDirectoryPages(
          (pageOffset, limit) => listAdminPublished({ ...adminFilters, offset: pageOffset, limit, hydrateCoverage: false }),
          ADMIN_BATCH, DIRECTORY_CEILING,
        )
        : listAdminPublished({ ...adminFilters, offset, limit: 100, hydrateCoverage: false }),
      cityCoverageSearch && coverageCityIds.length
        ? collectPublicDirectoryPages(loadCoveragePage, PUBLIC_BATCH, DIRECTORY_CEILING)
        : Promise.resolve([]),
    ]);
    const eligible = await readPublicEligibleRows(publicClient() as unknown as PublicEligibilityRpc, [...rows, ...coveredRows]);
    const published = await withReferralHighlights(await withPioneerBadges(await withOnlineStatus(eligible.map(sanitizePublicTechnician))));
    const unified = await withCoverageCities([...published, ...adminPublished]);
    if (cityCoverageSearch) {
      // A base-city match can also declare that same city as coverage.
      // Never return or rank the same public UUID twice.
      const distinct = [...new Map(unified.map(row => [row.id, row] as const)).values()];
      return publicDirectoryPage(rankTechniciansByDeclaredArea(
        distinct, { uf, cidade: city, bairro: "" },
      ), data.pagina);
    }
    if (rankingArea) return publicDirectoryPage(rankTechniciansByDeclaredArea(unified, rankingArea), data.pagina);
    return unified.sort((a,b) => Number(b.online_now)-Number(a.online_now) || Number(Boolean(b.referral_highlight))-Number(Boolean(a.referral_highlight)) || Number(Boolean(b.pioneer_bronze))-Number(Boolean(a.pioneer_bronze)));
  });

export const getApprovedTechnician = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(96) }).parse(d))
  .handler(async ({ data }): Promise<PublicTechnician | null> => {
    setResponseHeader("Cache-Control", "no-store");
    const isUuid = isValidTechnicianId(data.id);
    if (!isUuid && !isValidTechnicianSlug(data.id)) return null;
    if (/^tecnico-[a-f0-9]{32}$/.test(data.id)) {
      return (await listAdminPublished({ slug: data.id }))[0] ?? null;
    }
    const lookupColumn = isUuid ? "id" : "public_slug";
    const { data: row, error } = await publicClient()
      .from("technicians")
      .select(COLUMNS)
      .eq("status", "aprovado")
      .eq(lookupColumn, data.id.toLowerCase())
      .maybeSingle();
    // A failed database lookup must never be mistaken for an unpublished profile.
    // A genuine no-match is { data: null, error: null } from maybeSingle().
    if (error) {
      console.error("getApprovedTechnician lookup failed", error.code ?? "unknown");
      throw new Error("Não foi possível consultar o perfil do técnico.");
    }
    if (!row) return null;
    const eligible = await readPublicEligibleRows(publicClient() as unknown as PublicEligibilityRpc, [row]);
    if (!eligible.length) return null; // Suspended/banned/not eligible => real 404 in route loader.
    const profile = (await withCoverageCities(await withReferralHighlights(await withPioneerBadges(await withOnlineStatus([sanitizePublicTechnician(eligible[0]!)])))))[0];
    if (!profile) return null;
    // Optional until the isolated SQL proposal passes its release gate. The server
    // projects a strict allowlist; never forward unvalidated RPC JSON to the browser.
    const { data: operations, error: operationsError } = await (publicClient() as unknown as SupabaseClient)
      .rpc("eut_public_technician_operations", { _technician_id: profile.id });
    if (operationsError) {
      console.warn("public operational profile unavailable", operationsError.code ?? "unknown");
    }
    const permitted = operationsError ? null : technicianOperationsSchema.safeParse(operations);
    const validCities = profile.coverage_city_ids ?? [];
    const projected = permitted && permitted.success &&
      [...permitted.data.free_city_ids, ...permitted.data.paid_city_ids].every(id => validCities.includes(id))
      ? permitted.data : null;
    return { ...profile, operations: projected };
  });
