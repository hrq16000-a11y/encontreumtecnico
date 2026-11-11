import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { groupPublishedCoverage, type CoverageSource, type CoverageLocation } from "@/lib/public-coverage";

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

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
