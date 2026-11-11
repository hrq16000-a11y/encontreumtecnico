import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPublicSitemapXml } from "./public-sitemap";

const read = (path: string) => readFileSync(path, "utf8");
const site = "https://www.encontreumtecnico.com";

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
    expect(xml).toContain('const SITE = "' + site + '"');
    for (const pathname of [
      "/", "/tecnicos", "/lp2", "/lp2/galeria", "/servicos",
      "/como-funciona", "/faq", "/contato", "/politicas",
      "/termos", "/privacidade", "/cookies",
      "/pagamentos-e-reembolsos", "/condicoes-do-prestador",
      "/responsabilidades", "/seguranca", "/direitos-dos-titulares",
    ]) {
      expect(xml, pathname).toContain('"' + pathname + '"');
    }
    for (const path of ["/entrar", "/admin", "/area-cliente", "/area-tecnico", "/redefinir-senha", "/home2", "/tecnico/$slug"]) {
      expect(xml).not.toContain('"' + path + '"');
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
  it("inclui automaticamente perfis canônicos e protege as rotas privadas no sitemap", () => {
    const xml = buildPublicSitemapXml(["/", "/tecnicos", "/admin", "/home2"], [
      { public_slug: "tecnico-real-curitiba-pr", updated_at: "2026-11-11T12:00:00.000Z" },
      { public_slug: "../invalido", updated_at: null },
    ]);
    expect(xml).toContain("https://www.encontreumtecnico.com/tecnicos/tecnico-real-curitiba-pr");
    expect(xml).toContain("<lastmod>2026-11-11T12:00:00.000Z</lastmod>");
    expect(xml).not.toContain("https://www.encontreumtecnico.com/admin");
    expect(xml).not.toContain("https://www.encontreumtecnico.com/home2");
    expect(xml).not.toContain("../invalido");
    const datasource = read("src/lib/public-sitemap.ts");
    expect(datasource).toContain('.eq("status", "aprovado")');
    expect(datasource).toContain('.select("public_slug,updated_at")');
  });
});
