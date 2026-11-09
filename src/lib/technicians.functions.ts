import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PublicTechnician = {
  id: string;
  display_name: string;
  specialties: string[];
  city: string;
  region: string | null;
  state_uf: string | null;
  neighborhood: string | null;
  bio: string | null;
};
export type PublicCategory = { slug: string; label: string; display_order: number };
export type PublicService = { slug: string; category_slug: string; label: string; display_order: number };
export type PublicServiceCatalog = { categories: PublicCategory[]; services: PublicService[] };

const COLUMNS = "id,display_name,specialties,city,region,state_uf,neighborhood,bio";
const UF = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
const OLD_CATEGORY_SLUGS: Record<string,string> = {
  "Ar-condicionado": "climatizacao",
  "Automação": "automacao",
  "CFTV": "cftv",
  "Computador": "computadores",
  "Comunicações": "comunicacoes",
  "Elétrica": "eletrica",
  "Gráfica": "design-grafico",
  "Impressora": "impressoras",
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

async function readPublicServiceCatalog(): Promise<PublicServiceCatalog> {
  // Catalog tables are maintained in external Supabase and not in the Lovable generated types.
  const db = publicClient() as unknown as SupabaseClient;
  const [cats, svcs] = await Promise.all([
    db.from("eut_service_categories")
      .select("slug,label,display_order").eq("active", true).order("display_order").order("label"),
    db.from("eut_service_types")
      .select("slug,category_slug,label,display_order").eq("active", true).order("display_order").order("label"),
  ]);
  if (cats.error || svcs.error) {
    console.error("public catalog query failed", cats.error?.code || svcs.error?.code);
    throw new Error("Não foi possível carregar categorias e serviços.");
  }
  const categories = (cats.data ?? []) as PublicCategory[];
  const allowed = new Set(categories.map(c => c.slug));
  const services = ((svcs.data ?? []) as PublicService[])
    .filter(service => allowed.has(service.category_slug));
  return { categories, services };
}
export const listPublicServiceCatalog = createServerFn({ method: "GET" })
  .handler(readPublicServiceCatalog);

// Remove characters that could alter PostgREST filter syntax.
const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);

export const listApprovedTechnicians = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({
    especialidade: z.string().max(80),
    cidade: z.string().max(80),
    regiao: z.string().max(80),
    uf: z.string().max(2),
    bairro: z.string().max(80),
  }).parse(d))
  .handler(async ({ data }): Promise<PublicTechnician[]> => {
    let q = publicClient().from("technicians").select(COLUMNS)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(200);
    const filter = data.especialidade.trim();
    if (filter && filter !== "Todas") {
      const catalog = await readPublicServiceCatalog();
      const mappedLegacy = OLD_CATEGORY_SLUGS[filter];
      const categorySlug = filter.startsWith("cat:") ? filter.slice(4) : mappedLegacy;
      const serviceSlug = filter.startsWith("svc:") ? filter.slice(4) : "";
      let labels: string[] = [];
      if (categorySlug && catalog.categories.some(c => c.slug === categorySlug)) {
        labels = catalog.services.filter(s => s.category_slug === categorySlug).map(s => s.label);
      } else if (serviceSlug) {
        const service = catalog.services.find(s => s.slug === serviceSlug);
        if (service) labels = [service.label];
      }
      // An unknown/deactivated category or an empty catalog must never return all technicians.
      if (!labels.length) return [];
      q = q.overlaps("specialties", labels);
    }
    const city = clean(data.cidade);
    if (city) q = q.ilike("city", `%${city}%`);
    const region = clean(data.regiao);
    if (region) q = q.ilike("region", `%${region}%`);
    const neighborhood = clean(data.bairro);
    if (neighborhood) q = q.ilike("neighborhood", `%${neighborhood}%`);
    const state = data.uf.toUpperCase();
    if (state) {
      if (!UF.has(state)) return [];
      q = q.eq("state_uf", state);
    }
    const { data: rows, error } = await q;
    if (error) {
      console.error("listApprovedTechnicians", error.code);
      throw new Error("Não foi possível carregar os técnicos.");
    }
    return (rows ?? []) as PublicTechnician[];
  });

export const getApprovedTechnician = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicTechnician | null> => {
    const { data: row } = await publicClient().from("technicians")
      .select(COLUMNS).eq("status", "aprovado").eq("id", data.id).maybeSingle();
    return (row ?? null) as PublicTechnician | null;
  });
