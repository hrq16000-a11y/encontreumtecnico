import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  links: vi.fn(),
  notFound: vi.fn(() => Object.assign(new Error("HTTP_404_NOT_FOUND"), { status: 404 })),
  redirect: vi.fn(() => new Error("REDIRECT")),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  Link: () => null,
}));
vi.mock("../lib/technicians.functions", () => ({
  getApprovedTechnician: mocks.profile,
}));
vi.mock("@/lib/public-seo-graph.functions", () => ({
  getSeoProfileLinks: mocks.links,
}));
vi.mock("../components/page-placeholder", () => ({
  PageShell: () => null,
}));
vi.mock("@/components/public-technician-profile", () => ({
  PublicTechnicianProfile: () => null,
}));
import { Route } from "./tecnicos.$tecnicoId";

type RouteUnderTest = {
  loader: (input: { params: { tecnicoId: string } }) => Promise<any>;
  head: (input: { loaderData: any; params: { tecnicoId: string } }) => {
    links: Array<{ rel: string; href: string }>;
    meta: Array<Record<string, string>>;
  };
};
const route = Route as unknown as RouteUnderTest;
const slug = "qa-tecnico-curitiba";
const valid = { id: "12345678-1234-4234-8234-123456789abc",
  public_slug: slug, display_name: "Profissional de teste",
  city: "Curitiba", state_uf: "PR", specialties: ["redes"] };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.links.mockResolvedValue({ city: null, categories: [], related: [] });
});

describe("Staging-only synthetic 404 boundary for public technician profiles", () => {
  it("allows an eligible profile then emits a 404 marker immediately after a ban", async () => {
    mocks.profile.mockResolvedValueOnce(valid).mockResolvedValueOnce(null);
    const before = await route.loader({ params: { tecnicoId: slug } });
    expect(route.head({ loaderData: before, params: { tecnicoId: slug } }).links)
      .toContainEqual({ rel: "canonical",
        href: "https://www.encontreumtecnico.com.br/tecnicos/" + slug });
    await expect(route.loader({ params: { tecnicoId: slug } }))
      .rejects.toMatchObject({ status: 404, message: "HTTP_404_NOT_FOUND" });
    expect(mocks.profile).toHaveBeenCalledTimes(2);
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    // No loaderData or canonical can be produced after the 404.
  });

  it("does not claim 404 if eligibility RPC fails: propagate unavailable result", async () => {
    mocks.profile.mockRejectedValue(new Error("Public technician eligibility unavailable"));
    await expect(route.loader({ params: { tecnicoId: slug } }))
      .rejects.toThrow("Public technician eligibility unavailable");
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.links).not.toHaveBeenCalled();
  });

  it("rejects malformed path without querying a technician or the SEO graph", async () => {
    await expect(route.loader({ params: { tecnicoId: "../admin" } }))
      .rejects.toMatchObject({ status: 404 });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.links).not.toHaveBeenCalled();
  });
});
// These are handler-level tests with mocked database access, NOT a real HTTP
// request to Vercel/staging. The live 404/cache test remains a release gate.
