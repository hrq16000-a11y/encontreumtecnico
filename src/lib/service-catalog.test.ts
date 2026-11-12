import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDES, GUIDE_PATHS, getPublishedGuide } from "./public-guides";
import { ENRICHED_CATEGORY_PATHS, SERVICE_CATEGORIES, getEnrichedServiceCategory } from "./service-catalog";
import { buildPublicSitemapXml, SITE } from "./public-sitemap";
import { SPECIALTY_CONTENT } from "./service-specialty-content";
import { getGuideFaqs } from "./guide-faqs";
import { getGuideArtwork } from "./guide-artwork";
import { getRelatedServiceCategories } from "./service-catalog";

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

  it("publica dois conteúdos completos de automação e telefonia dentro do catálogo, sem páginas de blog", () => {
    expect(SPECIALTY_CONTENT).toHaveLength(2);
    const sitemap = buildPublicSitemapXml([]);
    const visual = read("src/components/guide-section-visual.tsx");
    const catalog = read("src/lib/service-catalog.ts");
    const route = read("src/routes/servicos.$categoria.tsx");
    const directory = read("src/routes/tecnicos.index.tsx");
    for (const content of SPECIALTY_CONTENT) {
      const entry = getEnrichedServiceCategory(content.categorySlug);
      expect(entry?.guide).toBe(content);
      expect(content.sections).toHaveLength(5);
      expect(content.sections.every(section =>
        section.paragraphs.length >= 2 && (section.checklist?.length ?? 0) >= 4
      )).toBe(true);
      expect(content.introduction.length).toBeGreaterThan(200);
      expect(content.finalAdvice.length).toBeGreaterThan(150);
      const faq = getGuideFaqs(content.slug);
      expect(faq).toHaveLength(4);
      expect(faq.every(item => item.question.length > 30 && item.answer.length > 110)).toBe(true);
      const artwork = getGuideArtwork(content.categorySlug);
      expect(artwork.src).toContain("/servicos/");
      expect(artwork.alt.length).toBeGreaterThan(50);
      const file = "public" + artwork.src;
      const svg = read(file);
      expect(svg).toContain("<svg");
      expect(svg).toContain("<title");
      expect(svg).toContain("<desc");
      expect(svg).not.toMatch(/<script|<foreignObject|onload\\s*=/i);
      expect(new TextEncoder().encode(svg).length).toBeLessThan(12000);
      expect(visual).toContain(content.categorySlug + ": ");
      expect(sitemap).toContain(SITE + "/servicos/" + content.categorySlug + "</loc>");
      expect(sitemap).not.toContain(SITE + "/guias/" + content.slug + "</loc>");
      expect(directory).toContain(content.categorySlug + ": {");
      expect(getRelatedServiceCategories(content.categorySlug).length).toBeGreaterThanOrEqual(2);
    }
    expect(catalog).toContain("getSpecialtyContent(category.slug)");
    expect(route).toContain("getRelatedServiceCategories(category.slug)");
    expect(route).toContain("listApprovedTechnicians({");
    expect(route).toContain("listingUnavailable: true");
    expect(route).toContain('to="/tecnicos/$tecnicoId"');
    expect(route).not.toContain("contact_phone");
    expect(sitemap).not.toContain("/area-cliente");
    expect(sitemap).not.toContain("/admin");
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
    expect(cta).toContain('automacao: "Automação"');
    expect(cta).toContain('comunicacoes: "Comunicações e telefonia"');
    expect(funnel).toContain('"Automação", "Comunicações e telefonia", "Outro serviço"');
    expect(funnel).toContain("if (requestError) throw requestError;");
    expect(funnel.indexOf("setSavedWhatsAppLead(lead);"))
      .toBeGreaterThan(funnel.indexOf("if (requestError) throw requestError;"));
  });
});
