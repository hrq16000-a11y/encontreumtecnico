import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDES, GUIDE_PATHS, getPublishedGuide } from "./public-guides";
import { getGuideArtwork } from "./guide-artwork";
import { buildPublicSitemapXml, SITE } from "./public-sitemap";

const read = (path: string) => readFileSync(path, "utf8");
const site = "https://www.encontreumtecnico.com.br";

describe("SEO global do Encontre um Técnico", () => {
  it("declara canonical correto nas páginas públicas", () => {
    expect(read("src/routes/servicos.tsx")).toContain('rel: "canonical", href: "' + site + '/servicos"');
    expect(read("src/routes/como-funciona.tsx")).toContain('rel: "canonical", href: "' + site + '/como-funciona"');
    expect(read("src/routes/faq.tsx")).toContain('"/faq")');
    expect(read("src/routes/contato.tsx")).toContain('"/contato")');
    const helper = read("src/components/text-page.tsx");
    expect(helper).toContain('rel: "canonical"');
    expect(helper).toContain("canonicalPath");
    for (const [name, uri] of [
      ["src/routes/index.tsx", site + "/"],
      ["src/routes/tecnicos.index.tsx", site + "/tecnicos"],
      ["src/routes/lp2/index.tsx", site + "/lp2"],
      ["src/routes/lp2/galeria.tsx", site + "/lp2/galeria"],
    ] as const) {
      const code = read(name);
      expect(code, name).toContain("canonical");
      if (name === "src/routes/index.tsx") {
        expect(code).toContain('const SITE = "' + site + '"');
        expect(code).toContain('href: SITE + "/"');
      } else {
        expect(code, name).toContain(uri);
      }
    }
  });

  it("mantém a Home2 fora do índice enquanto houver duplicidade de intenção", () => {
    const home2 = read("src/routes/home2.tsx");
    expect(home2).toContain('name: "robots", content: "noindex, nofollow"');
    expect(home2).toContain(site + "/home2");
    expect(read("src/routes/sitemap[.]xml.ts")).not.toContain('"/home2"');
  });

  it("mantém sitemap com URLs canônicas e exclui rotas privadas", () => {
    const xml = read("src/routes/sitemap[.]xml.ts");
    const builder = read("src/lib/public-sitemap.ts");
    expect(builder).toContain('export const SITE = "' + site + '"');
    expect(xml).toContain("buildPublicSitemapXml(profiles)");
    expect(xml).toContain('.eq("status", "aprovado")');
    for (const pathname of [
      "/", "/tecnicos", "/lp2", "/lp2/galeria", "/servicos",
      "/como-funciona", "/faq", "/contato", "/politicas",
      "/termos", "/privacidade", "/cookies",
      "/pagamentos-e-reembolsos", "/condicoes-do-prestador",
      "/responsabilidades", "/seguranca", "/direitos-dos-titulares",
    ]) {
      expect(builder, pathname).toContain('"' + pathname + '"');
    }
    for (const path of ["/entrar", "/admin", "/area-cliente", "/area-tecnico", "/redefinir-senha", "/home2", "/tecnico/$slug"]) {
      expect(builder).not.toContain('"' + path + '"');
    }
    const robots = read("public/robots.txt");
    expect(robots).toContain("Sitemap: " + site + "/sitemap.xml");
    expect(robots).toContain("Allow: /");
  });

  it("mantém noindex em páginas privadas, históricas e de contato protegido", () => {
    for (const file of [
      "src/routes/entrar.tsx", "src/routes/admin.tsx",
      "src/routes/area-cliente.tsx", "src/routes/area-tecnico.tsx",
      "src/routes/redefinir-senha.tsx", "src/routes/reivindicar-cadastro.tsx",
      "src/routes/acesso-contato.$tecnicoId.tsx", "src/routes/tecnico.$slug.tsx",
      "src/routes/cliente.$slug.tsx", "src/routes/lp2/entrar.tsx",
      "src/routes/lp2/admin.tsx", "src/routes/lp2/cliente.tsx",
    ]) {
      expect(read(file), file).toContain("noindex");
    }
    expect(read("src/routes/tecnicos.$tecnicoId.tsx")).toContain("...(!loaderData ?");
    expect(read("src/routes/lp2/tecnico.$slug.tsx")).toContain("!loaderData");
    const root = read("src/routes/__root.tsx");
    expect(root).not.toContain('name: "robots", content: "noindex, nofollow"');
    expect(root).toContain('<html lang="pt-BR"');
    for (const file of [
      "src/routes/index.tsx", "src/routes/tecnicos.index.tsx",
      "src/routes/tecnicos.$tecnicoId.tsx", "src/routes/sitemap[.]xml.ts",
      "public/robots.txt",
    ]) {
      expect(read(file), file).not.toContain("find-your-trusted-technician.lovable.app");
    }
  });

  it("retorna notFound para perfil inexistente sem esconder erro do banco", () => {
    const profile = read("src/routes/tecnicos.$tecnicoId.tsx");
    const query = read("src/lib/technicians.functions.ts");
    expect(profile).toContain('if (!isLegacyUuid && !isValidTechnicianSlug(params.tecnicoId)) throw notFound()');
    expect(profile).toContain('statusCode: 301');
    expect(profile).toContain('technician.public_slug');
    expect(profile).toContain('loaderData?.public_slug');
    const technicianList = read("src/routes/tecnicos.index.tsx");
    const technicianCard = read("src/components/technician-search-card.tsx");
    expect(technicianList).toContain("TechnicianSearchCard");
    expect(technicianCard).toContain('to="/tecnicos/$tecnicoId"');
    expect(technicianCard).toContain("params={{ tecnicoId: t.public_slug }}");
    expect(technicianCard).not.toContain('contact_phone');
    expect(profile).toContain('if (!technician) throw notFound()');
    expect(query).toContain('if (error) {');
    expect(query).toContain('throw new Error("Não foi possível consultar o perfil do técnico.")');
    expect(read("src/routes/__root.tsx")).toContain('notFoundComponent: NotFoundComponent');
    expect(read("scripts/eut-public-smoke.mjs"))
      .toContain('["/tecnicos/00000000-0000-0000-0000-000000000000", 404]');
  });

  it("preserva redirecionamentos legados 301/302 sem criar URLs duplicadas", () => {
    const gallery = read("src/routes/galeria.tsx");
    expect(gallery).toContain('to: "/tecnicos"');
    expect(gallery).toContain("statusCode: 302");
    const list = read("src/routes/lista-de-tecnicos.tsx");
    expect(list).toContain('to: "/tecnicos"');
    expect(list).toContain("statusCode: 301");
    for (const [path, to] of [
      ["src/routes/termos-de-uso.tsx", "/termos"],
      ["src/routes/politica-de-privacidade.tsx", "/privacidade"],
      ["src/routes/politica-de-cookies.tsx", "/cookies"],
    ] as const) {
      const source = read(path);
      expect(source).toContain('to: "' + to + '"');
      expect(source).toContain("statusCode: 301");
    }
  });
  it("enriquece serviços reais e encaminha para a busca filtrada sem URLs artificiais", () => {
    const services = read("src/routes/servicos.tsx");
    expect(services).toContain('search={{ especialidade: service.slug, cidade: "", regiao: "" }}');
    expect(services).toContain("Como encontrar o profissional adequado");
    expect(services).toContain('https://www.encontreumtecnico.com.br/servicos');
    for (const slug of [
      "climatizacao", "automacao", "cftv", "computadores", "comunicacoes",
      "eletrica", "design-grafico", "impressoras", "redes", "software",
    ]) expect(services, slug).toContain('slug: "' + slug + '"');
    expect(services).not.toContain("WhatsApp direto");
  });

  it("publica somente guias autorais com canonical, dados Article e links para técnicos", () => {
    expect(GUIDES).toHaveLength(4);
    expect(new Set(GUIDES.map(guide => guide.slug)).size).toBe(GUIDES.length);
    expect(GUIDE_PATHS).toHaveLength(GUIDES.length + 1);
    const index = read("src/routes/guias.index.tsx");
    const detail = read("src/routes/guias.$slug.tsx");
    const services = read("src/routes/servicos.tsx");
    const sitemap = buildPublicSitemapXml([]);
    expect(index).toContain('createFileRoute("/guias/")');
    expect(detail).toContain('createFileRoute("/guias/$slug")');
    expect(detail).toContain("throw notFound()");
    expect(detail).toContain('"script:ld+json"');
    expect(detail).toContain('rel: "canonical"');
    expect(detail).toContain('especialidade: guide.categorySlug');
    expect(services).toContain('to="/guias"');
    expect(SITE).toBe("https://www.encontreumtecnico.com.br");
    expect(sitemap).toContain('<loc>' + SITE + '/guias</loc>');
    for (const guide of GUIDES) {
      expect(guide.sections.length).toBeGreaterThanOrEqual(5);
      expect(guide.sections.every(section => section.paragraphs.length > 0)).toBe(true);
      expect(guide.description.length).toBeGreaterThan(65);
      expect(guide.title.length).toBeGreaterThan(35);
      expect(guide.publishedAt).toBe("2026-11-11");
      expect(guide.updatedAt).toBe("2026-11-11");
      expect(sitemap).toContain('<loc>' + SITE + '/guias/' + guide.slug + '</loc>');
      expect(getPublishedGuide(guide.slug)?.title).toBe(guide.title);
      expect(getGuideArtwork(guide.categorySlug).src).toContain("/guias/");
      expect(getGuideArtwork(guide.categorySlug).alt.length).toBeGreaterThan(35);
    }
    expect(getPublishedGuide("../admin")).toBeNull();
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/area-cliente");
    for (const slug of ["wifi-caindo-sinal-fraco-como-identificar", "impressora-offline-fila-travada-o-que-fazer"]) {
      expect(sitemap).toContain(SITE + "/guias/" + slug + "</loc>");
    }
  });
  it("mostra somente cobertura declarada de perfis públicos e a inclui no sitemap", () => {
    const route = read("src/routes/cobertura.tsx");
    const source = read("src/lib/public-coverage.functions.ts");
    const sitemap = buildPublicSitemapXml([]);
    expect(route).toContain("getPublicCoverageOverview");
    expect(route).toContain('rel: "canonical", href: SITE + "/cobertura"');
    expect(source).toContain('.eq("status", "aprovado")');
    expect(source).toContain('.select("public_slug,display_name,city,state_uf")');
    expect(sitemap).toContain("<loc>" + SITE + "/cobertura</loc>");
    expect(read("src/components/site-footer.tsx")).toContain('to="/cobertura"');
    expect(read("src/components/public-technician-profile.tsx")).toContain('to="/cobertura"');
  });

  it("mostra imagens originais, infográficos e CTAs intermediários ligados ao funil sem WhatsApp público", () => {
    const article = read("src/routes/guias.$slug.tsx");
    const index = read("src/routes/guias.index.tsx");
    const visuals = read("src/components/guide-section-visual.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    expect(article).toContain("<GuideSectionVisual categorySlug={guide.categorySlug} index={index} />");
    expect(article).toContain("index === 1 || index === 3");
    expect(article).toContain("<GuideLeadCallout guide={guide} compact />");
    expect(article).toContain('to="/ecossistema"');
    expect(index).toContain('loading="lazy"');
    expect(cta).toContain("openFreeHelp");
    expect(cta).toContain('mode: "managed"');
    expect(cta).toContain("guideSlug: guide.slug");
    expect(cta).not.toMatch(/wa[.]me|api[.]whatsapp[.]com/i);
    expect(visuals).toContain("Infográfico ilustrativo");
    for (const asset of [
      "public/guias/computador-diagnostico-ilustrado.svg",
      "public/guias/cftv-planejamento-ilustrado.svg",
      "public/guias/wifi-instabilidade-cobertura-ilustrado.svg",
      "public/guias/impressora-offline-fila-ilustrado.svg",
    ]) {
      const svg = read(asset);
      expect(svg).toContain("<svg");
      expect(svg).toContain("<title");
      expect(svg).toContain("<desc");
      expect(svg).not.toMatch(/<script|<foreignObject|onload\s*=/i);
      expect(new TextEncoder().encode(svg).length).toBeLessThan(12000);
    }
  });

  it("publica ecossistema editorial útil e impede página de troca de links sem contexto", () => {
    const ecosystem = read("src/routes/ecossistema.tsx");
    const sitemap = buildPublicSitemapXml([]);
    expect(ecosystem).toContain('createFileRoute("/ecossistema")');
    expect(ecosystem).toContain("Cada domínio mantém condições");
    expect(ecosystem).toContain('rel: "canonical", href: SITE + "/ecossistema"');
    for (const host of ["0web.com.br", "mestredosservicos.com.br", "encontreumprofissional.com.br", "precisodeum.com.br"]) {
      expect(ecosystem).toContain(host);
    }
    expect(ecosystem).not.toContain("precisodeumprossional.com.br");
    expect(sitemap).toContain("<loc>" + SITE + "/ecossistema</loc>");
  });
});
