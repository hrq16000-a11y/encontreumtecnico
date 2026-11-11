import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPublicGraph, categoryGraphPath, cityGraphPath, profilesInCategory,
  profilesInCity, relatedGraphProfiles, type GraphProfile,
} from "./public-seo-graph";
import { buildPublicSitemapXml, SITE } from "./public-sitemap";

const source: GraphProfile[] = [
  { public_slug: "tecnica-curitiba", display_name: "Técnica Curitibana", city: "Curitiba",
    state_uf: "PR", specialties: ["cftv", "redes", "categoria-inativa"],
    service_slugs: ["instalacao-cameras", "wifi"], updated_at: "2026-11-10T10:00:00Z" },
  { public_slug: "tecnico-cftv", display_name: "Especialista CFTV", city: "Curitiba",
    state_uf: "PR", specialties: ["cftv"], service_slugs: ["instalacao-cameras"],
    updated_at: "2026-11-11T10:00:00Z" },
  { public_slug: "rede-sao-paulo", display_name: "Redes SP", city: "São Paulo",
    state_uf: "SP", specialties: ["redes"], service_slugs: ["wifi"],
    updated_at: "2026-11-09T10:00:00Z" },
  { public_slug: "grande-porto-alegre", display_name: "Região Porto Alegre",
    city: "Região Metropolitana de Porto Alegre", state_uf: "RS",
    specialties: ["cftv"], service_slugs: ["instalacao-cameras"] },
  { public_slug: "profissional-sem-catalogo", display_name: "Técnico",
    city: "Cidade Inventada", state_uf: "PR",
    specialties: ["categoria-inativa"], service_slugs: [] },
  { public_slug: "../admin", display_name: "Telefone 41999998888", city: "Curitiba",
    state_uf: "PR", specialties: ["cftv"], service_slugs: [] },
  { public_slug: "tecnica-curitiba", display_name: "Duplicado",
    city: "Curitiba", state_uf: "PR", specialties: ["cftv"], service_slugs: [] },
];
const municipalities = [
  { name: "Curitiba", uf: "PR" }, { name: "SÃO PAULO", uf: "SP" },
  { name: "Porto Alegre", uf: "RS" },
];
const activeCategories = [
  { slug: "cftv", label: "Câmeras e CFTV" },
  { slug: "redes", label: "Redes de computadores" },
];

describe("Grafo público de interlinks indexáveis", () => {
  const graph = buildPublicGraph(source, municipalities, activeCategories);

  it("cria cidade somente quando há perfil real e município reconhecido", () => {
    expect(graph.profiles).toHaveLength(5);
    expect(graph.cities.map((c) => cityGraphPath(c))).toEqual([
      "/cidades/pr/curitiba", "/cidades/sp/sao-paulo",
    ]);
    expect(graph.cities[0].count).toBe(2);
    expect(graph.cities[0].updated_at).toBe("2026-11-11T10:00:00Z");
    expect(graph.cities.some((c) => c.slug.includes("regiao-metropolitana"))).toBe(false);
    expect(graph.cities.some((c) => c.slug.includes("cidade-inventada"))).toBe(false);
    expect(profilesInCity(graph, "PR", "curitiba")).toHaveLength(2);
    expect(profilesInCity(graph, "PR", "cidade-inventada")).toHaveLength(0);
  });

  it("liga apenas categorias ATIVAS com técnico aprovado (sem URLs vazias)", () => {
    expect(graph.categories.map(c => categoryGraphPath(c))).toEqual([
      "/categorias/cftv", "/categorias/redes",
    ]);
    expect(graph.categories.find(c => c.slug === "cftv")?.count).toBe(3);
    expect(profilesInCategory(graph, "cftv")).toHaveLength(3);
    expect(profilesInCategory(graph, "categoria-inativa")).toHaveLength(0);
  });

  it("relaciona perfis por cidade, categoria ou serviço, nunca aleatoriamente nem ao próprio", () => {
    const related = relatedGraphProfiles(graph, graph.profiles[0]);
    expect(related.map(x => x.public_slug)).toEqual([
      "tecnico-cftv", "rede-sao-paulo", "grande-porto-alegre",
    ]);
    expect(related[0].relation).toBe("Mesmo município");
    expect(related[1].relation).toBe("Serviço em comum");
    expect(related.some(x => x.public_slug === "tecnica-curitiba")).toBe(false);
    expect(related.some(x => x.public_slug === "profissional-sem-catalogo")).toBe(false);
    expect(relatedGraphProfiles(graph, graph.profiles[0], 1)).toHaveLength(1);
  });

  it("publica só URLs canônicas e genuínas no sitemap, sem perfis malformados ou regiões falsas", () => {
    const xml = buildPublicSitemapXml(graph.profiles, graph.cities, graph.categories);
    for (const path of [
      "/tecnicos/tecnica-curitiba", "/tecnicos/tecnico-cftv",
      "/cidades/pr/curitiba", "/cidades/sp/sao-paulo",
      "/categorias/cftv", "/categorias/redes",
    ]) expect(xml).toContain(`<loc>${SITE}${path}</loc>`);
    expect(xml).not.toContain("../admin");
    expect(xml).not.toContain("/cidades/rs/regiao-metropolitana");
    expect(xml).not.toContain("/categorias/categoria-inativa");
    expect(xml).not.toContain("/area-cliente");
    expect(xml.match(/<loc>/g)).toHaveLength(17 + 5 + 2 + 2);
  });

  it("preserva retornos HTTP 404 reais para cidades/categorias não publicadas", () => {
    for (const file of ["src/routes/cidades.$uf.$cidade.tsx", "src/routes/categorias.$categoria.tsx"]) {
      const route = readFileSync(file, "utf8");
      expect(route).toContain("if (!result) throw notFound()");
      expect(route).toContain('rel: "canonical"');
      expect(route).toContain("PublicSeoDirectory");
    }
  });

  it("não lê CPF, telefone, endereço, e-mail, listas banidas nem chaves administrativas", () => {
    const source = readFileSync("src/lib/public-seo-graph.functions.ts", "utf8");
    expect(source).toContain('.eq("status", "aprovado")');
    expect(source).toContain(".from(\"eut_ibge_municipalities\")");
    expect(source).toContain('.eq("active", true)');
    expect(source).toContain("SUPABASE_PUBLISHABLE_KEY");
    expect(source).not.toContain("SERVICE_ROLE");
    expect(source).not.toContain("phone_e164");
    expect(source).not.toContain("contact_phone");
    expect(source).not.toContain("auth.users");
    expect(source).toContain("MAX_PROFILE_PAGES");
  });
});
