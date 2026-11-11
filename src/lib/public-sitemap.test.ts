import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPublicSitemapXml } from "./public-sitemap";

const read = (path: string) => readFileSync(path, "utf8");
const paths = ["/", "/tecnicos", "/servicos", "/faq", "/privacidade"];

describe("sitemap público automático", () => {
  it("gera somente as URLs canônicas válidas com datas reais, sem duplicatas", () => {
    const xml = buildPublicSitemapXml(paths, [
      { public_slug: "exemplo-curitiba-pr", updated_at: "2026-11-10T15:35:12.000Z" },
      { public_slug: "exemplo-curitiba-pr", updated_at: "2026-11-11T15:35:12.000Z" },
      { public_slug: "outro-sao-paulo-sp", updated_at: null },
    ]);
    expect(xml).toContain('<loc>https://www.encontreumtecnico.com/tecnicos/exemplo-curitiba-pr</loc>');
    expect(xml).toContain("<lastmod>2026-11-11T15:35:12.000Z</lastmod>");
    expect(xml.match(/<loc>https:\/\/www\.encontreumtecnico\.com\/tecnicos\/exemplo-curitiba-pr<\/loc>/g)).toHaveLength(1);
    expect(xml).toContain('<loc>https://www.encontreumtecnico.com/tecnicos/outro-sao-paulo-sp</loc>');
    expect(xml.match(/<loc>/g)).toHaveLength(7);
    expect(xml).not.toContain("<priority>");
    expect(xml).not.toContain("<changefreq>");
  });
  it("rejeita URLs injetadas, slugs inseguros, filtros e rotas privadas", () => {
    const xml = buildPublicSitemapXml(["/", "/admin", "/entrar?x=1", "https://evil.example", "/area-tecnico", "/tecnicos"],
      [{ public_slug: "../admin", updated_at: null }, { public_slug: "nome<private>", updated_at: null },
       { public_slug: "valido-pr", updated_at: "invalid-date" }]);
    expect(xml).not.toContain("evil.example");
    expect(xml).not.toContain("nome&lt;private&gt;");
    expect(xml).not.toContain("/entrar?x=1");
    expect(xml).not.toContain("../admin");
    expect(xml).toContain("/tecnicos/valido-pr</loc>");
    expect(xml).not.toContain("<lastmod>");
  });
  it("consulta exclusivamente perfis aprovados e colunas públicas, paginados", () => {
    const source = read("src/lib/public-sitemap.ts");
    expect(source).toContain('.select("public_slug,updated_at")');
    expect(source).toContain('.eq("status", "aprovado")');
    expect(source).toContain(".range(start, start + PROFILE_PAGE_SIZE - 1)");
    expect(source).not.toMatch(/service_role|private_contacts|contact_phone|\.from\("profiles"\)/i);
  });
  it("sitemap é dinâmico, cache curto, falha fechado, robots aponta para a rota", () => {
    const route = read("src/routes/sitemap[.]xml.ts");
    expect(route).toContain("await loadPublishedSitemapProfiles()");
    expect(route).toContain("buildPublicSitemapXml(PATHS, profiles)");
    expect(route).toContain('status: 503');
    expect(route).toContain("s-maxage=300");
    expect(read("public/robots.txt")).toContain("Sitemap: https://www.encontreumtecnico.com/sitemap.xml");
    for (const path of ["/admin", "/area-tecnico", "/area-cliente", "/entrar", "/home2", "/tecnico/$slug"])
      expect(route).not.toContain('"' + path + '"');
  });
  it("serviços apontam para filtro de especialidade e cobrem as categorias ativas", () => {
    const services = read("src/routes/servicos.tsx");
    expect(services).toContain("especialidade: service.slug");
    for (const slug of ["cftv", "computadores", "redes", "impressoras", "software", "climatizacao",
      "automacao", "comunicacoes", "eletrica", "design-grafico"])
      expect(services).toContain('slug: "' + slug + '"');
  });
});
