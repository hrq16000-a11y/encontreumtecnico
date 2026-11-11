import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDES, GUIDE_PATHS, getPublishedGuide } from "./public-guides";
import { ENRICHED_CATEGORY_PATHS, SERVICE_CATEGORIES, getEnrichedServiceCategory } from "./service-catalog";
import { buildPublicSitemapXml, SITE } from "./public-sitemap";

const read = (path: string) => readFileSync(path, "utf8");

describe("Encontre um Técnico: conteúdo nas entranhas do catálogo", () => {
  it("mantém dez categorias, enriquece seis com conteúdo original e evita páginas finas", () => {
    expect(SERVICE_CATEGORIES).toHaveLength(10);
    expect(new Set(SERVICE_CATEGORIES.map(x => x.slug)).size).toBe(10);
    expect(GUIDES).toHaveLength(6);
    expect(ENRICHED_CATEGORY_PATHS).toHaveLength(8);
    for (const guide of GUIDES) {
      const entry = getEnrichedServiceCategory(guide.categorySlug);
      expect(entry?.guide).toBe(guide);
      expect(entry?.category.slug).toBe(guide.categorySlug);
      expect(guide.sections).toHaveLength(5);
      expect(ENRICHED_CATEGORY_PATHS).toContain("/servicos/" + guide.categorySlug);
      expect(guide.introduction.length).toBeGreaterThan(170);
    }
    for (const slug of ["eletrica", "design-grafico"]) {
      expect(getEnrichedServiceCategory(slug)).toBeNull();
      expect(ENRICHED_CATEGORY_PATHS).not.toContain("/servicos/" + slug);
    }
    expect(getEnrichedServiceCategory("../admin")).toBeNull();
  });

  it("indexa páginas de especialidade, não as URLs antigas de artigos 301", () => {
    const sitemap = buildPublicSitemapXml([]);
    expect(GUIDE_PATHS).toEqual(["/guias"]);
    expect(sitemap.match(/<loc>/g)).toHaveLength(28);
    expect(sitemap).toContain(SITE + "/guias</loc>");
    for (const guide of GUIDES) {
      expect(sitemap).toContain(SITE + "/servicos/" + guide.categorySlug + "</loc>");
      expect(sitemap).not.toContain(SITE + "/guias/" + guide.slug + "</loc>");
      expect(getPublishedGuide(guide.slug)).toBe(guide);
    }
    const legacy = read("src/routes/guias.$slug.tsx");
    expect(legacy).toContain("statusCode: 301");
    expect(legacy).toContain('to: "/servicos/$categoria"');
    expect(legacy).toContain("throw notFound()");
  });

  it("renderiza a rota filha de categoria e não duplica canonical do catálogo pai", () => {
    const parent = read("src/routes/servicos.tsx");
    const child = read("src/routes/servicos.$categoria.tsx");
    expect(parent).toContain("Outlet, useRouterState");
    expect(parent).toContain("if (isCategoryDetail) return <Outlet />");
    expect(parent).toContain('match.pathname.startsWith("/servicos/")');
    expect(parent).toContain('head: ({ matches }) =>');
    expect(child).toContain('rel: "canonical", href: canonical');
    expect(child).toContain("Profissionais cadastrados nesta especialidade");
    expect(child).toContain("Informação prática dentro da especialidade");
  });

  it("reutiliza segurança de perfis publicados e mantém contato protegido no funil", () => {
    const category = read("src/routes/servicos.$categoria.tsx");
    const directory = read("src/routes/tecnicos.index.tsx");
    const source = read("src/lib/technicians.functions.ts");
    const cta = read("src/components/guide-lead-callout.tsx");
    const funnel = read("src/components/assistance-funnel.tsx");
    expect(category).toContain("listApprovedTechnicians({");
    expect(category).toContain("technicians.slice(0, 6)");
    expect(category).toContain("listingUnavailable: true");
    expect(category).toContain('to="/tecnicos/$tecnicoId"');
    expect(category).not.toContain("contact_phone");
    expect(source).toContain('.eq("status", "aprovado")');
    expect(directory).toContain("CATEGORY_SEARCH_CONTEXT[search.especialidade]");
    expect(directory).toContain('to="/servicos/$categoria"');
    expect(cta).toContain("openFreeHelp");
    expect(cta).toContain('guideSlug: guide.slug');
    expect(funnel).toContain("if (requestError) throw requestError;");
    expect(funnel.indexOf("setSavedWhatsAppLead(lead);"))
      .toBeGreaterThan(funnel.indexOf("if (requestError) throw requestError;"));
  });
});
