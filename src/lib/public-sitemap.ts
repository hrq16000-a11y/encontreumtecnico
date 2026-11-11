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

export function buildPublicSitemapXml(profiles: readonly PublicSitemapProfile[]): string {
  const lines = [...PUBLIC_PATHS, ...GUIDE_PATHS].map((path) =>
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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
}
