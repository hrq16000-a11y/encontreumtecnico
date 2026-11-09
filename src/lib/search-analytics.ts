import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export function analyticsAllowed(raw: string | null): boolean {
  try { return raw !== null && JSON.parse(raw).analytics === true; } catch { return false; }
}

export const searchEventSchema = z.object({
  especialidade: z.string().trim().max(80),
  cidade: z.string().trim().max(80),
  regiao: z.string().trim().max(80),
  resultCount: z.number().int().nonnegative(),
});

export function toSearchEvent(input: z.infer<typeof searchEventSchema>) {
  const data = searchEventSchema.parse(input);
  const filters = [
    ...(data.especialidade && data.especialidade !== "Todas" ? ["especialidade"] : []),
    ...(data.cidade ? ["cidade"] : []),
    ...(data.regiao ? ["regiao"] : []),
  ];
  return { category: data.especialidade || "Todas", city: data.cidade, region: data.regiao, filters, result_count: data.resultCount };
}

export async function recordSearch(input: z.infer<typeof searchEventSchema>) {
  if (!analyticsAllowed(localStorage.getItem("eut-cookie-consent"))) return;
  const { error } = await supabase.from("search_events").insert(toSearchEvent(input));
  if (error) console.error("Não foi possível registrar a busca", error.code);
}

export const metricsSchema = z.object({
  total: z.number(),
  categories: z.array(z.object({ label: z.string(), value: z.number() })),
  cities: z.array(z.object({ label: z.string(), value: z.number() })),
  filters: z.array(z.object({ label: z.string(), value: z.number() })),
});