import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  city: vi.fn(),
  category: vi.fn(),
  notFound: vi.fn(() => new Error("HTTP_NOT_FOUND_404")),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  notFound: mocks.notFound,
}));
vi.mock("@/lib/public-seo-graph.functions", () => ({
  getSeoCity: mocks.city,
  getSeoCategory: mocks.category,
}));
vi.mock("@/components/page-placeholder", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
import { Route as CityRoute } from "./cidades.$uf.$cidade";
import { Route as CategoryRoute } from "./categorias.$categoria";

type RouteFixture = {
  loader: (input: { params: Record<string, string> }) => Promise<unknown>;
  head: (input: { loaderData?: any }) => { links: Array<{ rel: string; href: string }>; meta: Array<Record<string, string>> };
  component: () => ReactNode;
};
const cityRoute = CityRoute as unknown as RouteFixture;
const categoryRoute = CategoryRoute as unknown as RouteFixture;

beforeEach(() => vi.resetAllMocks());

describe("SSR de rotas de cidade/categoria: loader, canonical, 404 real", () => {
  it("página de cidade existente recebe loader aprovado, canonical e links SSR", async () => {
    const fixture = {
      city: { name: "Curitiba", uf: "PR", slug: "curitiba", count: 1 },
      profiles: [{
        public_slug: "tecnica-curitiba", display_name: "Técnica Curitiba",
        city: "Curitiba", state_uf: "PR", specialties: ["redes"], service_slugs: ["wifi"],
      }],
      categories: [{ slug: "redes", label: "Redes", count: 1 }],
    };
    mocks.city.mockResolvedValue(fixture);
    expect(await cityRoute.loader({ params: { uf: "pr", cidade: "curitiba" } })).toEqual(fixture);
    expect(mocks.city).toHaveBeenCalledWith({ data: { uf: "pr", city: "curitiba" } });
    const head = cityRoute.head({ loaderData: fixture });
    expect(head.links).toEqual([
      { rel: "canonical", href: "https://www.encontreumtecnico.com.br/cidades/pr/curitiba" },
    ]);
    expect(head.meta).toEqual(expect.arrayContaining([expect.objectContaining({ title: expect.stringContaining("Curitiba/PR") })]));
  });

  it("rota inexistente lança notFound, em vez de renderizar HTML de soft 404", async () => {
    mocks.city.mockResolvedValue(null);
    mocks.category.mockResolvedValue(null);
    await expect(cityRoute.loader({ params: { uf: "pr", cidade: "cidade-inexistente" } })).rejects.toThrow("HTTP_NOT_FOUND_404");
    await expect(categoryRoute.loader({ params: { categoria: "servico-inexistente" } })).rejects.toThrow("HTTP_NOT_FOUND_404");
    expect(mocks.notFound).toHaveBeenCalledTimes(2);
  });

  it("categoria real recebe canonical e descrição factual", async () => {
    const fixture = {
      category: { slug: "redes", label: "Redes", count: 1 },
      profiles: [{ public_slug: "tecnica-curitiba", display_name: "Técnica Curitiba", city: "Curitiba", state_uf: "PR", specialties: ["redes"] }],
      cities: [{ name: "Curitiba", slug: "curitiba", uf: "PR", count: 1 }],
    };
    mocks.category.mockResolvedValue(fixture);
    expect(await categoryRoute.loader({ params: { categoria: "redes" } })).toEqual(fixture);
    expect(categoryRoute.head({ loaderData: fixture }).links).toEqual([
      { rel: "canonical", href: "https://www.encontreumtecnico.com.br/categorias/redes" },
    ]);
  });
});
