import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildPublicSitemapXml, type PublicSitemapProfile } from "@/lib/public-sitemap";

// Only publish real, currently approved profile slugs. No client IDs, old
// WordPress drafts, restricted contacts, profile descriptions or user data.
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

async function approvedProfilesForSitemap(): Promise<PublicSitemapProfile[]> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Public sitemap source is not configured");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const published: PublicSitemapProfile[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client.from("technicians")
      .select("public_slug,updated_at")
      .eq("status", "aprovado")
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new Error("Unable to read the public technician directory");
    const batch = data ?? [];
    published.push(...batch);
    if (batch.length < PAGE_SIZE) return published;
  }
  // Fail rather than silently omit approved profiles after the safety cap.
  throw new Error("Public sitemap must be split into indexes before growing further");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const profiles = await approvedProfilesForSitemap();
          return new Response(buildPublicSitemapXml(profiles), {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          // Do not return a misleading static-only 200 sitemap during a DB
          // outage: crawlers should retry after the failure is resolved.
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
