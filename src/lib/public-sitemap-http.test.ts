import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPublicGraph } from "@/lib/public-seo-graph";

const mocks = vi.hoisted(() => ({
  getPublicGraphSnapshot: vi.fn(),
}));
vi.mock("@/lib/public-seo-graph.functions", () => ({
  getPublicGraphSnapshot: mocks.getPublicGraphSnapshot,
}));

import { publicSitemapPartResponse } from "@/lib/public-sitemap-http";

const graph = buildPublicGraph(
  [{
    public_slug: "tecnica-curitiba",
    display_name: "Técnica de informática",
    city: "Curitiba", state_uf: "PR",
    specialties: ["informatica"], service_slugs: ["notebooks"],
  }],
  [{ name: "Curitiba", uf: "PR" }],
  [{ slug: "informatica", label: "Informática" }],
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPublicGraphSnapshot.mockResolvedValue(graph);
});

describe("HTTP real das respostas de sitemap segmentado (sem Supabase/produção)", () => {
  it("retorna Response 200 XML e cache para uma página que existe", async () => {
    const response = await publicSitemapPartResponse("tecnicos", 1);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("s-maxage=900");
    expect(await response.text()).toContain(
      "<loc>https://www.encontreumtecnico.com.br/tecnicos/tecnica-curitiba</loc>",
    );
  });

  it("retorna 404 sem cache para lote inexistente, sem soft 404", async () => {
    const response = await publicSitemapPartResponse("tecnicos", 2);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.text())).not.toContain("<urlset");
  });

  it("retorna 503 sem cache quando a fonte pública falha", async () => {
    mocks.getPublicGraphSnapshot.mockRejectedValue(new Error("read-only database unavailable"));
    const response = await publicSitemapPartResponse("cidades");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("read-only database");
  });

  it("não publica sitemaps vazios de cidades e categorias", async () => {
    mocks.getPublicGraphSnapshot.mockResolvedValue({
      profiles: [], cities: [], categories: [],
    });
    const category = await publicSitemapPartResponse("categorias");
    const cities = await publicSitemapPartResponse("cidades");
    expect(category.status).toBe(404);
    expect(cities.status).toBe(404);
  });
});
