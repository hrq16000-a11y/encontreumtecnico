import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildPublicSitemapXml, PUBLIC_PATHS, SITE } from "./public-sitemap";

describe("Sitemap dinâmico com técnicos publicados", () => {
  it("mantém 17 rotas públicas e adiciona somente slugs legítimos de profissionais publicados", () => {
    const xml = buildPublicSitemapXml([
      { public_slug: "tecnico-curitiba", updated_at: "2026-11-10T12:00:00Z" },
      { public_slug: "tecnica-cftv-sp", updated_at: "2026-11-09T10:00:00Z" },
      { public_slug: "tecnico-curitiba", updated_at: "2026-11-10T12:00:00Z" },
      { public_slug: "../admin" },
      { public_slug: "<script>" },
      { public_slug: "" },
      { public_slug: null },
    ]);
    expect(PUBLIC_PATHS).toHaveLength(17);
    expect(SITE).toBe("https://www.encontreumtecnico.com.br");
    expect(xml).toContain("<loc>" + SITE + "/tecnicos/tecnico-curitiba</loc>");
    expect(xml).toContain("<lastmod>2026-11-10</lastmod>");
    expect(xml).toContain("<loc>" + SITE + "/tecnicos/tecnica-cftv-sp</loc>");
    expect(xml.match(/<loc>[^<]+tecnico-curitiba<\/loc>/g)).toHaveLength(1);
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("/area-cliente");
    expect(xml).not.toContain("/acesso-contato");
    expect(xml.match(/<url>/g)).toHaveLength(19);
  });
  it("declara consulta pública, somente aprovados, paginação, 503 e cache curto", () => {
    const handler = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");
    const source = readFileSync("src/lib/public-seo-graph.functions.ts", "utf8");
    expect(handler).toContain("getPublicGraphSnapshot()");
    expect(handler).toContain("graph.profiles, graph.cities, graph.categories");
    expect(source).toContain('.select("public_slug,display_name,city,state_uf,specialties,service_slugs,updated_at")');
    expect(source).toContain('.eq("status", "aprovado")');
    expect(source).toContain('.range(page * BATCH, (page + 1) * BATCH - 1)');
    expect(source).toContain('eut_ibge_municipalities');
    expect(source).toContain('.eq("active", true)');
    expect(handler).toContain("status: 503");
    expect(handler).toContain("s-maxage=900");
    expect(handler).not.toContain("SERVICE_ROLE");
    expect(handler).not.toContain("contact_phone");
    expect(handler).not.toContain("auth.users");
  });
});
