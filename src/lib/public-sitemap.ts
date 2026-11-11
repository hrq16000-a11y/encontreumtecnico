import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isValidTechnicianSlug } from "@/lib/technician-id";

export type SitemapProfile = { public_slug: string | null; updated_at: string | null };

const SITEMAP_MAX_URLS = 50_000;
const PROFILE_PAGE_SIZE = 1_000;
const PROFILE_LIMIT = 49_000;
const SITE = "https://www.encontreumtecnico.com";
// Defense in depth if a future editor accidentally adds a private route.
const PRIVATE_PATH = /^\/(?:admin|area-(?:tecnico|cliente)|entrar|cadastro|acesso-contato|redefinir-senha|reivindicar-cadastro|cliente|tecnico|convite|home2)(?:\/|$)|^\/lp2\/(?:admin|entrar|cliente|cadastro)(?:\/|$)/;

const xmlEscape = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function lastModified(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Only valid canonical paths; never generate guesswork, filtered URLs or contact links. */
export function buildPublicSitemapXml(paths: readonly string[], profiles: readonly SitemapProfile[]): string {
  const urls = new Map<string, string | null>();
  for (const path of paths) {
    if (/^\/[a-z0-9./-]*$/.test(path) && !PRIVATE_PATH.test(path)) urls.set(path, null);
  }
  for (const row of profiles) {
    if (typeof row.public_slug !== "string" || !isValidTechnicianSlug(row.public_slug)) continue;
    urls.set("/tecnicos/" + row.public_slug, lastModified(row.updated_at));
  }
  if (urls.size > SITEMAP_MAX_URLS) throw new Error("Sitemap URL limit exceeded: split into shards");
  const records = [...urls].sort(([a], [b]) => a.localeCompare(b, "en")).map(([path, modified]) => {
    const location = xmlEscape(SITE + path);
    return "  <url><loc>" + location + "</loc>" +
      (modified ? "<lastmod>" + modified + "</lastmod>" : "") + "</url>";
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    records.join("\n") + "\n</urlset>\n";
}

/** Server-only, anonymous RLS-scoped, two public columns. Never use admin credentials.
 * A failed lookup should fail the sitemap request, rather than silently drop profiles.
 */
export async function loadPublishedSitemapProfiles(): Promise<SitemapProfile[]> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Sitemap public datasource unavailable");
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
  const profiles: SitemapProfile[] = [];
  for (let start = 0; start < PROFILE_LIMIT; start += PROFILE_PAGE_SIZE) {
    const { data, error } = await client.from("technicians")
      .select("public_slug,updated_at")
      .eq("status", "aprovado")
      .order("public_slug", { ascending: true })
      .range(start, start + PROFILE_PAGE_SIZE - 1);
    if (error || !Array.isArray(data)) throw new Error("Unable to load approved sitemap profiles");
    profiles.push(...data);
    if (data.length < PROFILE_PAGE_SIZE) return profiles;
  }
  // Never truncate silently. A sitemap index with chunks is required at this scale.
  throw new Error("Sitemap profile limit reached: use a sitemap index");
}
