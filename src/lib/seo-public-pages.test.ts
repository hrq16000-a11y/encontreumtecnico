import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { GUIDES, GUIDE_PATHS, getPublishedGuide, getRelatedGuides } from "./public-guides";
import { getGuideArtwork } from "./guide-artwork";
import { buildPublicSitemapXml, SITE } from "./public-sitemap";
import { isGuideDetailHeadMatch } from "./guide-font-loading";

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
    const graph = read("src/lib/public-seo-graph.functions.ts");
    expect(xml).toContain("getPublicGraphSnapshot()");
    expect(xml).toContain("buildPublicSitemapIndexXml(graph)");
    expect(graph).toContain('.eq("status", "aprovado")');
    expect(graph).toContain("readPublicEligibleRows(");
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
    ]) expect(read("src/lib/service-catalog.ts"), slug).toContain('slug: "' + slug + '"');
    expect(services).not.toContain("WhatsApp direto");
  });

  it("publica seis categorias ricas, mantém os artigos e redireciona o legado sem conteúdo duplicado", () => {
    expect(GUIDES).toHaveLength(6);
    expect(new Set(GUIDES.map(guide => guide.slug)).size).toBe(GUIDES.length);
    expect(GUIDE_PATHS).toEqual(["/guias"]);
    const index = read("src/routes/guias.index.tsx");
    const legacy = read("src/routes/guias.$slug.tsx");
    const category = read("src/routes/servicos.$categoria.tsx");
    const services = read("src/routes/servicos.tsx");
    const catalog = read("src/lib/service-catalog.ts");
    const sitemap = buildPublicSitemapXml([]);
    expect(index).toContain('createFileRoute("/guias/")');
    expect(index).toContain('to="/servicos/$categoria"');
    expect(legacy).toContain('createFileRoute("/guias/$slug")');
    expect(legacy).toContain("throw notFound()");
    expect(legacy).toContain("throw redirect({");
    expect(legacy).toContain("statusCode: 301");
    expect(legacy).toContain('to: "/servicos/$categoria"');
    expect(category).toContain('createFileRoute("/servicos/$categoria")');
    expect(category).toContain('"@type": "CollectionPage"');
    expect(category).toContain('rel: "canonical"');
    expect(category).toContain("listApprovedTechnicians({");
    expect(category).toContain("technicians.slice(0, 6)");
    expect(category).toContain('to="/tecnicos/$tecnicoId"');
    expect(category).not.toContain("contact_phone");
    expect(category).not.toContain("wa.me");
    expect(services).toContain("getEnrichedServiceCategory(service.slug)");
    // Parent /servicos yields to child /servicos/:categoria, preventing wrong canonical.
    expect(services).toContain("if (isCategoryDetail) return <Outlet />");
    expect(services).toContain('match.pathname.startsWith("/servicos/")');
    expect(services).toContain("head: ({ matches }) =>");
    expect(catalog).toContain("export const SERVICE_CATEGORIES");
    expect(SITE).toBe("https://www.encontreumtecnico.com.br");
    expect(sitemap).toContain('<loc>' + SITE + '/guias</loc>');
    for (const guide of GUIDES) {
      expect(guide.sections.length).toBeGreaterThanOrEqual(5);
      expect(guide.sections.every(section => section.paragraphs.length > 0)).toBe(true);
      expect(guide.description.length).toBeGreaterThan(65);
      expect(guide.title.length).toBeGreaterThan(35);
      expect(guide.publishedAt).toBe("2026-11-11");
      expect(sitemap).toContain('<loc>' + SITE + '/servicos/' + guide.categorySlug + '</loc>');
      expect(sitemap).not.toContain('<loc>' + SITE + '/guias/' + guide.slug + '</loc>');
      expect(getPublishedGuide(guide.slug)?.title).toBe(guide.title);
      expect(getGuideArtwork(guide.categorySlug).src).toContain("/guias/");
      expect(getGuideArtwork(guide.categorySlug).alt.length).toBeGreaterThan(35);
      expect(getRelatedGuides(guide.slug).every(x => x.slug !== guide.slug)).toBe(true);
    }
    expect(getPublishedGuide("../admin")).toBeNull();
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/area-cliente");
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
    const article = read("src/routes/servicos.$categoria.tsx");
    const index = read("src/routes/guias.index.tsx");
    const visuals = read("src/components/guide-section-visual.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    expect(article).toContain("<GuideSectionVisual categorySlug={guide.categorySlug} index={index} />");
    expect(article).toContain("index === 1 || index === 3");
    expect(article).toContain("<GuideLeadCallout guide={guide} compact />");
    expect(article).toContain('to="/servicos"');
    expect(index).toContain('loading={index === 0 ? "eager" : "lazy"}');
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
      "public/guias/backup-seguro-manutencao-ilustrado.svg",
      "public/guias/ar-condicionado-nao-gela-ilustrado.svg",
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

  it("gera conteúdo rico sobre backup e climatização com relacionamentos e leads contextuais", () => {
    const article = read("src/routes/servicos.$categoria.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    const visual = read("src/components/guide-section-visual.tsx");
    const guideSlugs = [
      "backup-arquivos-antes-manutencao-computador",
      "ar-condicionado-nao-gela-verificacoes-seguras",
    ];
    for (const slug of guideSlugs) {
      const guide = getPublishedGuide(slug);
      expect(guide).not.toBeNull();
      expect(guide?.sections.length).toBe(5);
      expect(guide?.sections.every(sec => sec.paragraphs.length > 0)).toBe(true);
      expect(guide?.description.length).toBeGreaterThan(75);
      expect(getRelatedGuides(slug).length).toBeGreaterThan(0);
    }
    expect(cta).toContain('software: "Sistemas e software"');
    expect(cta).toContain('climatizacao: "Climatização"');
    expect(cta).toContain("openFreeHelp");
    expect(article).toContain("getRelatedServiceCategories(category.slug)");
    expect(article).toContain('to="/servicos/$categoria"');
    expect(visual).toContain("software: BACKUP");
    expect(visual).toContain("climatizacao: CLIMATE");
  });
  it("integra FAQ e sumário contextual sem duplicar rotas, schema ou chamadas externas", () => {
    const article = read("src/routes/servicos.$categoria.tsx");
    const faq = read("src/components/guide-reading-tools.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    expect(article).toContain("<GuideReadingNavigation guide={guide} />");
    expect(article).toContain("<GuideFrequentlyAskedQuestions guide={guide} />");
    expect(faq).toContain('href={"#secao-" + index}');
    expect(faq).toContain('href="#perguntas-frequentes"');
    expect(faq).toContain("<details");
    expect(faq).toContain("<summary");
    expect(faq).not.toContain("FAQPage");
    expect(cta).toContain("requestHelpForGuide(guide)");
    expect(cta).not.toContain("api.whatsapp.com");
    expect(buildPublicSitemapXml([])).not.toContain("/perguntas-frequentes");
  });
  it("limita correção de fontes aos artigos e mantém funil coerente com categorias publicadas", () => {
    const article = read("src/routes/servicos.$categoria.tsx");
    const style = read("src/styles.css");
    const funnel = read("src/components/assistance-funnel.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    expect(article).toContain('className="eut-guide-stable-type mt-10 scroll-mt-28"');
    expect(style).toContain(".eut-guide-stable-type {");
    expect(style).toContain("font-family: system-ui");
    expect(style).toContain(".eut-guide-stable-type h1,");
    expect(style).not.toContain("body { font-family: system-ui");
    expect(cta).toContain('climatizacao: "Climatização"');
    expect(funnel).toContain('"Sistemas e software", "Climatização", "Outro serviço"');
    expect(funnel).toContain("if (requestError) throw requestError;");
    expect(funnel.indexOf("setSavedWhatsAppLead(lead);")).toBeGreaterThan(funnel.indexOf("if (requestError) throw requestError;"));
    expect(funnel).not.toContain("verifyMetaWebhookSignature");
  });

  it("evita Google Fonts bloqueantes apenas nos seis guias, preservando AdSense, SEO e áreas privadas", () => {
    const root = read("src/routes/__root.tsx");
    const guide = read("src/routes/servicos.$categoria.tsx");
    expect(root).toContain("head: ({ matches }) => ({");
    expect(root).toContain("...(!isGuideDetailHeadMatch(matches) ? [");
    expect(root).toContain("fonts.googleapis.com/css2?family=Manrope");
    expect(root).toContain("google-adsense-account");
    expect(root).toContain("<AdSenseLoader />");
    expect(root).toContain("href: appCss");
    expect(guide).toContain("eut-guide-stable-type");
    for (const published of GUIDES) {
      expect(isGuideDetailHeadMatch([{ pathname: "/servicos/" + published.categorySlug }])).toBe(true);
    }
    for (const pathname of [
      "/", "/guias", "/admin", "/area-cliente", "/area-tecnico",
      "/entrar", "/servicos", "/home2", "/lp2",
      "/guias/slug/invalido", "/guias/../admin",
    ]) {
      expect(isGuideDetailHeadMatch([{ pathname }]), pathname).toBe(false);
    }
    expect(isGuideDetailHeadMatch([
      { pathname: "/" }, { pathname: "/servicos/computadores" },
    ])).toBe(true);
    expect(isGuideDetailHeadMatch([])).toBe(false);
  });

  it("evita baixar o wizard completo antes de abrir o funil, sem perder SSR e proteção de dados", () => {
    const floating = read("src/components/free-search-help.tsx");
    const shell = read("src/components/page-placeholder.tsx");
    const wizard = read("src/components/assistance-funnel.tsx");
    const cta = read("src/components/guide-lead-callout.tsx");
    expect(floating).toContain('lazy(() =>');
    expect(floating).toContain('import("./assistance-funnel")');
    expect(floating).not.toContain('import { AssistanceFunnel } from "./assistance-funnel"');
    expect(floating).toContain("<Suspense fallback=");
    expect(floating).toContain("<LazyAssistanceFunnel key={JSON.stringify(context)}");
    expect(floating).toContain('window.addEventListener("eut-open-free-help"');
    expect(floating).toContain("{open && (");
    expect(shell).toContain("<FreeSearchHelp />");
    expect(cta).toContain("openFreeHelp");
    expect(wizard).toContain("readAssistanceDraft");
    expect(wizard).toContain("saveAssistanceDraft");
    expect(wizard).toContain("if (requestError) throw requestError;");
    expect(wizard.indexOf("setSavedWhatsAppLead(lead);"))
      .toBeGreaterThan(wizard.indexOf("if (requestError) throw requestError;"));
  });
});
