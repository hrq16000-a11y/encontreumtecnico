import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { isValidTechnicianSlug } from "@/lib/technician-id";
import { publicTextProblem } from "@/lib/public-profile-text";

export type CoverageSource = {
  public_slug: string | null;
  display_name: string;
  city: string;
  state_uf: string | null;
};

export type CoverageLocation = {
  uf: string;
  city: string;
  profiles: Array<{ slug: string; displayName: string }>;
};

const VALID_STATES = new Set<string>(BRAZIL_STATES);
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

/** A single actual approved base location counts once per public profile.
 * No inferred travel radius, IP/GPS, availability or unverified municipality claim.
 */
export function groupPublishedCoverage(records: readonly CoverageSource[]): CoverageLocation[] {
  const locations = new Map<string, CoverageLocation>();
  const seenSlugs = new Set<string>();
  for (const row of records) {
    const uf = (row.state_uf ?? "").trim().toUpperCase();
    const city = (row.city ?? "").trim().replace(/\s+/g, " ");
    const slug = row.public_slug ?? "";
    if (!VALID_STATES.has(uf) || !city || city.length > 100
      || publicTextProblem(city, "identity")
      || !isValidTechnicianSlug(slug) || publicTextProblem(slug, "identity")
      || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const cityKey = city.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
    const key = uf + ":" + cityKey;
    if (!locations.has(key)) locations.set(key, { uf, city, profiles: [] });
    const displayName = publicTextProblem(row.display_name, "identity")
      ? "Profissional cadastrado" : row.display_name.trim();
    locations.get(key)!.profiles.push({ slug, displayName });
  }
  return [...locations.values()]
    .map(location => ({ ...location, profiles: location.profiles.sort(
      (a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"),
    ) }))
    .sort((a,b) => a.uf.localeCompare(b.uf, "pt-BR")
      || a.city.localeCompare(b.city, "pt-BR"));
}

async function loadApprovedCoverage(): Promise<CoverageLocation[]> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Public coverage source unavailable");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const records: CoverageSource[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client.from("technicians")
      .select("public_slug,display_name,city,state_uf")
      .eq("status", "aprovado")
      .order("public_slug", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) throw new Error("Approved coverage lookup failed");
    records.push(...data);
    if (data.length < PAGE_SIZE) return groupPublishedCoverage(records);
  }
  // No silent partial directory when the public corpus grows beyond this limit.
  throw new Error("Coverage size requires pagination and a new view");
}

export const getPublicCoverageOverview = createServerFn({ method: "GET" })
  .handler(loadApprovedCoverage);
