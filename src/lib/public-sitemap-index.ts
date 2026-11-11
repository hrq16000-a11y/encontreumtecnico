import { GUIDE_PATHS } from "@/lib/public-guides";
import type { GraphCatalog } from "@/lib/public-seo-graph";
import {
  buildPublicSitemapXml,
  PUBLIC_PATHS,
  SITE,
} from "@/lib/public-sitemap";

/** Small shards keep XML below crawler URL/byte limits and bound response size. */
export const TECHNICIAN_SITEMAP_PAGE_SIZE = 1000;
export const MAX_URLS_PER_SITEMAP = 50_000;
export const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

export type PublicSitemapPart = {
  path: string;
  kind: "base" | "cidades" | "categorias" | "tecnicos";
  page?: number;
  count: number;
  lastmod: string | null;
};

function latestDate(values: readonly (string | null | undefined)[]): string | null {
  let latest: number | null = null;
  for (const value of values) {
    const time = value ? Date.parse(value) : NaN;
    if (!Number.isFinite(time) || time > Date.now()) continue;
    if (latest === null || time > latest) latest = time;
  }
  return latest === null ? null : new Date(latest).toISOString().slice(0, 10);
}

/**
 * Every child URL exists, has at least one canonical URL, and contains only
 * one section. Never publish a dangling sitemap page or a link to an empty page.
 */
export function listPublicSitemapParts(graph: GraphCatalog): PublicSitemapPart[] {
  const parts: PublicSitemapPart[] = [
    { kind: "base", path: "/sitemaps/base.xml", count: PUBLIC_PATHS.length + GUIDE_PATHS.length, lastmod: null },
  ];
  if (graph.cities.length) {
    parts.push({
      kind: "cidades", path: "/sitemaps/cidades.xml", count: graph.cities.length,
      lastmod: latestDate(graph.cities.map(city => city.updated_at)),
    });
  }
  if (graph.categories.length) {
    parts.push({
      kind: "categorias", path: "/sitemaps/categorias.xml", count: graph.categories.length,
      lastmod: latestDate(graph.categories.map(category => category.updated_at)),
    });
  }
  for (let offset = 0; offset < graph.profiles.length; offset += TECHNICIAN_SITEMAP_PAGE_SIZE) {
    const page = Math.floor(offset / TECHNICIAN_SITEMAP_PAGE_SIZE) + 1;
    const slice = graph.profiles.slice(offset, offset + TECHNICIAN_SITEMAP_PAGE_SIZE);
    parts.push({
      kind: "tecnicos", page,
      path: "/sitemaps/tecnicos/" + page + ".xml",
      count: slice.length,
      lastmod: latestDate(slice.map(profile => profile.updated_at)),
    });
  }
  if (parts.length > 50_000) throw new Error("Sitemap index requires partitioning");
  return parts;
}

export function buildPublicSitemapIndexXml(graph: GraphCatalog): string {
  const parts = listPublicSitemapParts(graph);
  const lines = parts.map(part => {
    const modified = part.lastmod ? "<lastmod>" + part.lastmod + "</lastmod>" : "";
    return "  <sitemap><loc>" + SITE + part.path + "</loc>" + modified + "</sitemap>";
  });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    lines.join("\n") + "\n</sitemapindex>\n";
  if (new TextEncoder().encode(xml).byteLength > MAX_SITEMAP_BYTES) {
    throw new Error("Sitemap index exceeds maximum size");
  }
  return xml;
}

export function buildPublicSitemapPartXml(
  graph: GraphCatalog,
  kind: PublicSitemapPart["kind"],
  page?: number,
): string | null {
  if (kind === "base") return buildPublicSitemapXml([], [], [], { includeStatic: true });
  if (kind === "cidades") {
    return graph.cities.length
      ? buildPublicSitemapXml([], graph.cities, [], { includeStatic: false }) : null;
  }
  if (kind === "categorias") {
    return graph.categories.length
      ? buildPublicSitemapXml([], [], graph.categories, { includeStatic: false }) : null;
  }
  if (!Number.isSafeInteger(page) || (page ?? 0) < 1) return null;
  const offset = ((page ?? 1) - 1) * TECHNICIAN_SITEMAP_PAGE_SIZE;
  const profiles = graph.profiles.slice(offset, offset + TECHNICIAN_SITEMAP_PAGE_SIZE);
  return profiles.length
    ? buildPublicSitemapXml(profiles, [], [], { includeStatic: false })
    : null;
}
