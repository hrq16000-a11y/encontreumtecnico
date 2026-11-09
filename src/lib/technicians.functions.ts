import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PublicTechnician = {
  id: string;
  display_name: string;
  specialties: string[];
  service_slugs: string[];
  state_uf: string | null;
  neighborhood: string | null;
  city: string;
  region: string | null;
  bio: string | null;
};

const COLUMNS = "id, display_name, specialties, service_slugs, city, state_uf, neighborhood, region, bio";

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

// Strip characters that would break PostgREST ilike filters.
const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);

export const listApprovedTechnicians = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ especialidade: z.string().max(80), cidade: z.string().max(80), regiao: z.string().max(80), servico: z.string().max(80).default(""), uf: z.string().max(2).default(""), bairro: z.string().max(80).default("") }).parse(d),
  )
  .handler(async ({ data }): Promise<PublicTechnician[]> => {
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
      q = q.eq("state_uf", uf);
    }
    const bairro = clean(data.bairro);
    if (bairro) q = q.ilike("neighborhood", `%${bairro}%`);
    const city = clean(data.cidade);
    if (city) q = q.ilike("city", `%${city}%`);
    const region = clean(data.regiao);
    if (region) q = q.ilike("region", `%${region}%`);
    const { data: rows, error } = await q;
    if (error) {
      console.error("listApprovedTechnicians", error);
      throw new Error("Não foi possível carregar os técnicos.");
    }
    return rows ?? [];
  });

export const getApprovedTechnician = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicTechnician | null> => {
    const { data: row } = await publicClient()
      .from("technicians")
      .select(COLUMNS)
      .eq("status", "aprovado")
      .eq("id", data.id)
      .maybeSingle();
    return row ?? null;
  });
