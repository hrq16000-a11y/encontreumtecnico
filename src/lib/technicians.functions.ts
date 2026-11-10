import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { rankTechniciansByDeclaredArea } from "@/lib/technician-local-ranking";
import { isValidTechnicianId, isValidTechnicianSlug } from "@/lib/technician-id";

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
  online_now: boolean;
  pioneer_bronze?: boolean;
  referral_highlight?: boolean;
};

const COLUMNS = "id, public_slug, display_name, specialties, service_slugs, city, state_uf, neighborhood, region, bio, avatar_path, service_radius_km, coverage_city_ids";

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
        return fetch(input, { ...init, headers: h });
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
    const { data, error } = await (publicClient() as unknown as SupabaseClient)
      .rpc("eut_online_published_ids", { _technician_ids: rows.map((row) => row.id) });
    if (error) throw error;
    const onlineIds = new Set(
      (Array.isArray(data) ? data : []).map((row: { technician_id: string }) => row.technician_id),
    );
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
    const { data, error } = await (publicClient() as unknown as SupabaseClient)
      .from("eut_pioneer_badges").select("technician_id")
      .in("technician_id", rows.map((row) => row.id));
    if (error) throw error;
    const ids = new Set((Array.isArray(data) ? data : [])
      .map((badge: { technician_id: string }) => badge.technician_id));
    return rows.map((row) => ({ ...row, pioneer_bronze: ids.has(row.id) }));
  } catch {
    return rows.map((row) => ({ ...row, pioneer_bronze: false }));
  }
}

/** Anonymous lookup returns only public approved IDs; never referral identities. */
async function withReferralHighlights(rows: PublicTechnician[]): Promise<PublicTechnician[]> {
  if (!rows.length) return [];
  try {
    const { data, error } = await (publicClient() as unknown as SupabaseClient)
      .rpc("eut_public_referral_highlights", {
        _technician_ids: rows.map((row) => row.id),
      });
    if (error) throw error;
    const highlighted = new Set((Array.isArray(data) ? data : [])
      .map((record: { technician_id: string }) => record.technician_id));
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
    const { data, error } = await (publicClient() as unknown as SupabaseClient)
      .from("eut_ibge_municipalities").select("id,name,uf").in("id", codes.slice(0, 1000));
    if (error) throw error;
    const byCode = new Map((Array.isArray(data) ? data : []).map(
      (city: { id: number; name: string; uf: string }) => [city.id, city],
    ));
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
    z.object({ especialidade: z.string().max(80), cidade: z.string().max(80), regiao: z.string().max(80), servico: z.string().max(80).default(""), uf: z.string().max(2).default(""), bairro: z.string().max(80).default(""), prioridade: z.string().max(12).default("") }).parse(d),
  )
  .handler(async ({ data }): Promise<PublicTechnician[]> => {
    // "Priorizar minha região" is not a strict geography filter. It ranks
    // among approved matching professionals so other regions remain options.
    const regionalPriority = data.prioridade === "regiao" && Boolean(data.uf || data.cidade.trim());
    let q = publicClient()
      .from("technicians")
      .select(COLUMNS)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.especialidade && data.especialidade !== "Todas") {
      const slug = LEGACY_CATEGORY_ALIASES[data.especialidade] ?? data.especialidade;
      const { data: active, error: catalogError } = await (publicClient() as unknown as SupabaseClient)
        .from("eut_service_categories").select("slug").eq("slug", slug).eq("active", true).maybeSingle();
      if (catalogError) throw new Error("Não foi possível validar a categoria selecionada.");
      if (!active) return [];
      q = q.contains("specialties", [slug]);
    }
    if (data.servico) {
      const { data: offered, error: serviceError } = await (publicClient() as unknown as SupabaseClient)
        .from("eut_service_types").select("slug,category_slug").eq("slug", data.servico).eq("active", true).maybeSingle();
      if (serviceError) throw new Error("Não foi possível validar o serviço escolhido.");
      if (!offered) return [];
      if (data.especialidade && data.especialidade !== "Todas" && (LEGACY_CATEGORY_ALIASES[data.especialidade] ?? data.especialidade) !== offered.category_slug) return [];
      q = q.contains("service_slugs", [data.servico]);
    }
    const uf = data.uf.toUpperCase();
    if (uf) {
      if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)) return [];
      if (!regionalPriority) q = q.eq("state_uf", uf);
    }
    const bairro = clean(data.bairro);
    if (bairro && !regionalPriority) q = q.ilike("neighborhood", `%${bairro}%`);
    const city = clean(data.cidade);
    if (city && !regionalPriority) q = q.ilike("city", `%${city}%`);
    const region = clean(data.regiao);
    if (region && !regionalPriority) q = q.ilike("region", `%${region}%`);
    const { data: rows, error } = await q;
    if (error) {
      console.error("listApprovedTechnicians", error);
      throw new Error("Não foi possível carregar os técnicos.");
    }
    const published = await withCoverageCities(await withReferralHighlights(await withPioneerBadges(await withOnlineStatus(rows ?? []))));
    if (!regionalPriority) return published.sort((a,b) => Number(b.online_now)-Number(a.online_now) || Number(Boolean(b.referral_highlight))-Number(Boolean(a.referral_highlight)) || Number(Boolean(b.pioneer_bronze))-Number(Boolean(a.pioneer_bronze)));
    return rankTechniciansByDeclaredArea(published, {
      uf, cidade: data.cidade, bairro: data.bairro,
    });
  });

export const getApprovedTechnician = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().min(1).max(96) }).parse(d))
  .handler(async ({ data }): Promise<PublicTechnician | null> => {
    const isUuid = isValidTechnicianId(data.id);
    if (!isUuid && !isValidTechnicianSlug(data.id)) return null;
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
    return row ? (await withCoverageCities(await withReferralHighlights(await withPioneerBadges(await withOnlineStatus([row])))))[0] ?? null : null;
  });
