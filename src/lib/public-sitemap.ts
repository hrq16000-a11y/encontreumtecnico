import { GUIDE_PATHS } from "@/lib/public-guides";
/** Public sitemap builder. Never accept names, phones or private legacy records. */
export const SITE = "https://www.encontreumtecnico.com.br";

export const PUBLIC_PATHS = [
  "/", "/tecnicos", "/cobertura", "/ecossistema", "/lp2", "/lp2/galeria", "/servicos",
  "/como-funciona", "/faq", "/contato", "/politicas",
  "/termos", "/privacidade", "/cookies", "/pagamentos-e-reembolsos",
  "/condicoes-do-prestador", "/responsabilidades", "/seguranca",
  "/direitos-dos-titulares",
] as const;

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PublicSitemapProfile = {
  public_slug: string | null;
  updated_at?: string | null;
};

export function buildPublicSitemapXml(
  profiles: readonly PublicSitemapProfile[],
  cities: readonly { uf: string; slug: string; count: number; updated_at?: string | null }[] = [],
  categories: readonly { slug: string; count: number; updated_at?: string | null }[] = [],
  options: { includeStatic?: boolean } = {},
): string {
  const lines = (options.includeStatic === false ? [] : [...PUBLIC_PATHS, ...GUIDE_PATHS]).map((path) =>
    `  <url><loc>${SITE}${path}</loc></url>`);
  const seen = new Set<string>();
  for (const profile of profiles) {
    const slug = profile.public_slug;
    if (!slug || slug.length > 96 || !VALID_SLUG.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const timestamp = profile.updated_at;
    const parsed = timestamp ? Date.parse(timestamp) : NaN;
    const modified = Number.isFinite(parsed) && parsed <= Date.now()
      ? `<lastmod>${new Date(parsed).toISOString().slice(0, 10)}</lastmod>`
      : "";
    lines.push(`  <url><loc>${SITE}/tecnicos/${slug}</loc>${modified}</url>`);
  }
  const lastmod = (value: string | null | undefined): string => {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) && parsed <= Date.now()
      ? `<lastmod>${new Date(parsed).toISOString().slice(0, 10)}</lastmod>`
      : "";
  };
  const seenLocations = new Set<string>();
  for (const city of cities) {
    const uf = city.uf.toLowerCase();
    const key = uf + "/" + city.slug;
    if (city.count < 1 || !/^[a-z]{2}$/.test(uf) ||
      !VALID_SLUG.test(city.slug) || seenLocations.has(key)) continue;
    seenLocations.add(key);
    lines.push(`  <url><loc>${SITE}/cidades/${key}</loc>${lastmod(city.updated_at)}</url>`);
  }
  const seenCategories = new Set<string>();
  for (const category of categories) {
    if (category.count < 1 || !VALID_SLUG.test(category.slug) ||
      seenCategories.has(category.slug)) continue;
    seenCategories.add(category.slug);
    lines.push(`  <url><loc>${SITE}/categorias/${category.slug}</loc>${lastmod(category.updated_at)}</url>`);
  }
  // One sitemap cannot exceed 50,000 URLs; fail loudly before publishing
  // an incomplete sitemap. The next scaling milestone is sitemap indexes.
  if (lines.length > 50_000) throw new Error("Split public sitemap into a sitemap index");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  if (new TextEncoder().encode(xml).byteLength > 50 * 1024 * 1024) {
    throw new Error("Split sitemap before 50 MB XML limit");
  }
  return xml;
}
