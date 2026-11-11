import { GUIDE_PATHS } from "@/lib/public-guides";
import { describe, expect, it } from "vitest";
import { buildPublicGraph, type GraphCatalog, type GraphProfile } from "@/lib/public-seo-graph";
import { PUBLIC_PATHS, SITE } from "@/lib/public-sitemap";
import {
  TECHNICIAN_SITEMAP_PAGE_SIZE,
  buildPublicSitemapIndexXml,
  buildPublicSitemapPartXml,
  listPublicSitemapParts,
} from "@/lib/public-sitemap-index";

const technician = (index: number): GraphProfile => ({
  public_slug: "tecnico-" + String(index).padStart(6, "0"),
  display_name: "Profissional de informática",
  city: "Curitiba",
  state_uf: "PR",
  specialties: ["informatica"],
  service_slugs: ["notebooks"],
  updated_at: "2026-11-10T08:00:00Z",
});

const graph = buildPublicGraph(
  [technician(1), technician(2), { ...technician(3), city: "Região Metropolitana de Curitiba" }],
  [{ name: "Curitiba", uf: "PR" }],
  [{ slug: "informatica", label: "Informática" }, { slug: "cftv", label: "CFTV" }],
);

describe("Índice dinâmico de sitemap e rotas filhas", () => {
  it("gera apenas filhos de seções não vazias e um lote de perfis", () => {
    const parts = listPublicSitemapParts(graph);
    expect(parts.map(p => p.path)).toEqual([
      "/sitemaps/base.xml", "/sitemaps/cidades.xml",
      "/sitemaps/categorias.xml", "/sitemaps/tecnicos/1.xml",
    ]);
    expect(parts.map(p => p.count)).toEqual([PUBLIC_PATHS.length + GUIDE_PATHS.length, 1, 1, 3]);
    const xml = buildPublicSitemapIndexXml(graph);
    expect(xml).toContain("<sitemapindex");
    expect(xml.match(/<sitemap>/g)).toHaveLength(4);
    for (const part of parts) {
      expect(xml).toContain("<loc>" + SITE + part.path + "</loc>");
    }
    expect(xml).not.toContain("localhost");
    expect(xml).not.toContain("/sitemaps/tecnicos/2.xml");
    expect(xml).not.toContain("categoria-inativa");
  });

  it("não duplica páginas gerais e não inclui contatos em nenhum shard", () => {
    const base = buildPublicSitemapPartXml(graph, "base");
    const cities = buildPublicSitemapPartXml(graph, "cidades");
    const categories = buildPublicSitemapPartXml(graph, "categorias");
    const professionals = buildPublicSitemapPartXml(graph, "tecnicos", 1);
    expect(base?.match(/<url>/g)).toHaveLength(PUBLIC_PATHS.length + GUIDE_PATHS.length);
    expect(cities?.match(/<url>/g)).toHaveLength(1);
    expect(categories?.match(/<url>/g)).toHaveLength(1);
    expect(professionals?.match(/<url>/g)).toHaveLength(3);
    expect(professionals).not.toContain("/cidades/pr/curitiba");
    expect(cities).not.toContain("/tecnicos/tecnico-000001");
    expect(categories).not.toContain("/tecnicos/tecnico-000001");
    expect(categories).toContain(SITE + "/categorias/informatica");
    expect(cities).toContain(SITE + "/cidades/pr/curitiba");
    for (const xml of [base, cities, categories, professionals]) {
      expect(xml).not.toMatch(/phone|wa\.me|@example\.com|private_contact|area-cliente/i);
      expect(xml).toContain("<urlset");
    }
  });

  it("rejeita páginas ausentes e índices inválidos em vez de servir sitemaps vazios", () => {
    expect(buildPublicSitemapPartXml(graph, "tecnicos", 0)).toBeNull();
    expect(buildPublicSitemapPartXml(graph, "tecnicos", 2)).toBeNull();
    expect(buildPublicSitemapPartXml(graph, "tecnicos", Number.NaN)).toBeNull();
    expect(buildPublicSitemapPartXml(graph, "tecnicos", 1.5)).toBeNull();
    const blank: GraphCatalog = { profiles: [], cities: [], categories: [] };
    expect(listPublicSitemapParts(blank)).toHaveLength(1);
    expect(buildPublicSitemapPartXml(blank, "cidades")).toBeNull();
    expect(buildPublicSitemapPartXml(blank, "categorias")).toBeNull();
    expect(buildPublicSitemapPartXml(blank, "tecnicos", 1)).toBeNull();
  });

  it("divide mais de 15 mil perfis em lotes completos, sem duplicações", () => {
    const many = buildPublicGraph(
      Array.from({ length: 15_005 }, (_, i) => technician(i + 1)),
      [{ name: "Curitiba", uf: "PR" }],
      [{ slug: "informatica", label: "Informática" }],
    );
    expect(TECHNICIAN_SITEMAP_PAGE_SIZE).toBe(1_000);
    const plan = listPublicSitemapParts(many);
    const pages = plan.filter(p => p.kind === "tecnicos");
    expect(pages).toHaveLength(16);
    expect(pages[0]?.count).toBe(1_000);
    expect(pages[15]?.count).toBe(5);
    const last = buildPublicSitemapPartXml(many, "tecnicos", 16);
    expect(last?.match(/<url>/g)).toHaveLength(5);
    expect(last).toContain("/tecnicos/tecnico-015005");
    expect(last).not.toContain("/tecnicos/tecnico-014000");
    expect(buildPublicSitemapPartXml(many, "tecnicos", 17)).toBeNull();
    const wholeIndex = buildPublicSitemapIndexXml(many);
    expect(wholeIndex.match(/<sitemap>/g)).toHaveLength(19);
    expect(wholeIndex).toContain(SITE + "/sitemaps/tecnicos/16.xml");
  });
});
