import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type PublicTechnician = {
  id: string;
  display_name: string;
  specialties: string[];
  city: string;
  region: string | null;
  bio: string | null;
};

const COLUMNS = "id, display_name, specialties, city, region, bio";

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
    z.object({ especialidade: z.string().max(80), cidade: z.string().max(80), regiao: z.string().max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<PublicTechnician[]> => {
    let q = publicClient()
      .from("technicians")
      .select(COLUMNS)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.especialidade && data.especialidade !== "Todas") q = q.contains("specialties", [data.especialidade]);
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
