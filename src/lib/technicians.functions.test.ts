import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GUIDE_PATHS } from "@/lib/public-guides";
import { ENRICHED_CATEGORY_PATHS } from "@/lib/service-catalog";
import { buildPublicGraph } from "@/lib/public-seo-graph";
import { PUBLIC_PATHS, SITE } from "@/lib/public-sitemap";
import { buildPublicSitemapIndexXml, buildPublicSitemapPartXml, listPublicSitemapParts } from "@/lib/public-sitemap-index";
import { PublicSeoDirectory } from "@/components/public-seo-discovery";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    in: vi.fn(),
  };
  query.select.mockImplementation(() => query);
  query.eq.mockImplementation(() => query);
  query.in.mockImplementation((column: string) =>
    column === "status" ? query : Promise.resolve({ data: [], error: null }));
  const client = {
    from: vi.fn(() => query),
    rpc: vi.fn(),
  };
  return { query, client };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: (...args: never[]) => unknown) => fn,
    }),
  }),
}));

// These tests invoke server functions outside TanStack's request context.
vi.mock("@tanstack/react-start/server", () => ({
  setResponseHeader: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mocks.client,
}));

const seoMocks = vi.hoisted(() => ({ publicGraph: vi.fn() }));
vi.mock("@/lib/public-seo-graph.functions", () => ({
  getPublicGraphSnapshot: seoMocks.publicGraph,
}));
import { publicSitemapPartResponse } from "@/lib/public-sitemap-http";
import { getApprovedTechnician } from "./technicians.functions";

const id = "12345678-1234-4234-8234-123456789abc";

beforeEach(() => {
  mocks.query.select.mockClear();
  mocks.query.eq.mockClear();
  mocks.query.maybeSingle.mockReset();
  mocks.query.in.mockImplementation((column: string) =>
    column === "status" ? mocks.query : Promise.resolve({ data: [], error: null }));
  mocks.client.from.mockClear();
  mocks.client.rpc.mockClear();
  mocks.client.rpc.mockImplementation((name: string, args?: { _ids?: string[] }) => Promise.resolve({
    data: name === "eut_public_eligible_technician_ids"
      ? (args?._ids ?? []).map(technician_id => ({ technician_id }))
      : [],
    error: null,
  }));
});

describe("public technician profile lookup", () => {
  it("returns null only for a confirmed no-match", async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getApprovedTechnician({ data: { id } })).toBeNull();
    expect(mocks.query.in).toHaveBeenCalledWith("status", ["aprovado", "pendente"]);
    expect(mocks.query.eq).toHaveBeenCalledWith("id", id);
  });

  it("resolves a published profile by its human-readable slug", async () => {
    const public_slug = "tecnico-de-exemplo-curitiba-pr";
    mocks.query.maybeSingle.mockResolvedValue({ data: { id, public_slug, display_name: "Exemplo", city: "Curitiba", state_uf: "PR", specialties: [], service_slugs: [], neighborhood: null, region: null, bio: null }, error: null });
    const result = await getApprovedTechnician({ data: { id: public_slug } });
    expect(mocks.query.eq).toHaveBeenCalledWith("public_slug", public_slug);
    expect(result?.id).toBe(id);
    expect(result?.public_slug).toBe(public_slug);
  });

  it("does not query Supabase for malicious or malformed slugs", async () => {
    expect(await getApprovedTechnician({ data: { id: "../admin" } })).toBeNull();
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it("does not claim that a profile is absent when the query fails", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST999", message: "temporary database failure" },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(getApprovedTechnician({ data: { id } }))
        .rejects.toThrow("Não foi possível consultar o perfil do técnico.");
      expect(log).toHaveBeenCalledWith("getApprovedTechnician lookup failed", "PGRST999");
    } finally {
      log.mockRestore();
    }
  });

  it("returns null for approved technician when moderation RPC revokes eligibility", async () => {
    const profile = { id, public_slug: "qa-revoked-curitiba",
      display_name: "Profissional sintético", city: "Curitiba",
      state_uf: "PR", specialties: ["redes"], service_slugs: [] };
    mocks.query.maybeSingle.mockResolvedValue({ data: profile, error: null });
    let revoked = false;
    mocks.client.rpc.mockImplementation((name: string, args?: { _ids?: string[] }) =>
      Promise.resolve({ data: name === "eut_public_eligible_technician_ids" && !revoked
          ? (args?._ids ?? []).map(technician_id => ({ technician_id })) : [],
        error: null }));
    expect((await getApprovedTechnician({ data: { id } }))?.public_slug).toBe(profile.public_slug);
    revoked = true;
    expect(await getApprovedTechnician({ data: { id } })).toBeNull();
    // Other profile enrichments can legitimately call unrelated RPCs.
    expect(mocks.client.rpc.mock.calls.filter(([name]) =>
      name === "eut_public_eligible_technician_ids")).toHaveLength(2);
  });

  it("does not turn moderation RPC outage into a false 404", async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: {
      id, public_slug: "qa-checks-curitiba", display_name: "Profissional sintético",
      specialties: [], city: "Curitiba", state_uf: "PR",
    }, error: null });
    mocks.client.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(getApprovedTechnician({ data: { id } }))
      .rejects.toThrow("Public technician eligibility unavailable");
  });

  it("returns only public fields when an approved profile exists", async () => {
    const profile = {
      id,
      public_slug: "tecnico-de-exemplo-curitiba-pr",
      display_name: "Técnico de exemplo",
      specialties: ["computadores"],
      service_slugs: ["formatacao"],
      state_uf: "PR",
      city: "Curitiba",
      neighborhood: "Centro",
      region: null,
      bio: null,
    };
    mocks.query.maybeSingle.mockResolvedValue({ data: profile, error: null });
    const result = await getApprovedTechnician({ data: { id } });
    expect(result).toEqual({ ...profile, online_now: false, pioneer_bronze: false, referral_highlight: false, coverage_cities: [] });
    const selectedFields = String(mocks.query.select.mock.calls[0]?.[0]);
    expect(selectedFields).not.toMatch(/phone|email|contact|password/i);
  });
});


describe("public SEO discovery integration — actual SSR and HTTP response contract", () => {
  const approved = [
    { public_slug: "tec-curitiba", display_name: "Técnico Curitiba",
      city: "Curitiba", state_uf: "PR", specialties: ["redes"], service_slugs: ["wifi"] },
    { public_slug: "tec-redes", display_name: "Profissional de redes",
      city: "Curitiba", state_uf: "PR", specialties: ["redes"], service_slugs: ["wifi"] },
  ];
  const graph = buildPublicGraph(
    approved,
    [{ name: "Curitiba", uf: "PR" }],
    [{ slug: "redes", label: "Redes" }],
  );

  it("renders crawlable city, category and technician links in server-generated HTML", () => {
    const html = renderToStaticMarkup(createElement(PublicSeoDirectory, {
      heading: "Técnicos em Curitiba/PR", summary: "Perfis aprovados",
      profiles: graph.profiles, categories: graph.categories, cities: graph.cities,
    }));
    for (const uri of ["/cidades/pr/curitiba", "/categorias/redes",
      "/tecnicos/tec-curitiba", "/tecnicos/tec-redes"]) {
      expect(html).toContain('href="' + uri + '"');
    }
    expect(html).toContain("<h1");
    expect(html).not.toMatch(/wa\.me|telefone privado|@example\.com|contact_phone/i);
  });

  it("preserves /cobertura and all original guides while splitting genuine URLs", () => {
    expect(PUBLIC_PATHS).toContain("/cobertura");
    const index = buildPublicSitemapIndexXml(graph);
    expect(index).toContain("<sitemapindex");
    const parts = listPublicSitemapParts(graph);
    expect(parts).toHaveLength(4);
    expect(parts[0]?.count).toBe(PUBLIC_PATHS.length + GUIDE_PATHS.length + ENRICHED_CATEGORY_PATHS.length);
    const staticXml = buildPublicSitemapPartXml(graph, "base") ?? "";
    expect(staticXml.match(/<url>/g)).toHaveLength(PUBLIC_PATHS.length + GUIDE_PATHS.length + ENRICHED_CATEGORY_PATHS.length);
    for (const guide of GUIDE_PATHS) expect(staticXml).toContain(SITE + guide + "</loc>");
    expect(staticXml).toContain(SITE + "/cobertura</loc>");
    const profilesXml = buildPublicSitemapPartXml(graph, "tecnicos", 1) ?? "";
    expect(profilesXml.match(/<url>/g)).toHaveLength(2);
    expect(profilesXml).not.toContain("/cobertura");
  });

  it("returns real Response objects with HTTP 200/404/503, never a misleading empty 200", async () => {
    seoMocks.publicGraph.mockResolvedValue(graph);
    const valid = await publicSitemapPartResponse("tecnicos", 1);
    expect(valid.status).toBe(200);
    expect(valid.headers.get("content-type")).toContain("application/xml");
    expect(await valid.text()).toContain(SITE + "/tecnicos/tec-curitiba");
    const absent = await publicSitemapPartResponse("tecnicos", 2);
    expect(absent.status).toBe(404);
    expect(absent.headers.get("cache-control")).toBe("no-store");
    seoMocks.publicGraph.mockRejectedValue(new Error("source unavailable"));
    const unavailable = await publicSitemapPartResponse("cidades");
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("cache-control")).toBe("no-store");
    seoMocks.publicGraph.mockReset();
  });

  it("splits 15,005 synthetic approved technicians into sixteen real sitemap pages", () => {
    const profiles = Array.from({ length: 15005 }, (_, i) => ({
      ...approved[0]!,
      public_slug: "tecnico-" + String(i + 1).padStart(6, "0"),
    }));
    const large = buildPublicGraph(profiles, [{ name: "Curitiba", uf: "PR" }],
      [{ slug: "redes", label: "Redes" }]);
    const shards = listPublicSitemapParts(large).filter(part => part.kind === "tecnicos");
    expect(shards).toHaveLength(16);
    expect(shards[0]?.count).toBe(1000);
    expect(shards[15]?.count).toBe(5);
    expect(buildPublicSitemapPartXml(large, "tecnicos", 16)).toContain("/tecnicos/tecnico-015005");
    expect(buildPublicSitemapPartXml(large, "tecnicos", 17)).toBeNull();
  });

  it("publishes city/category canonicals and 404 notFound loaders, never fabricated paths", () => {
    for (const path of ["src/routes/cidades.$uf.$cidade.tsx", "src/routes/categorias.$categoria.tsx"]) {
      const code = readFileSync(path, "utf8");
      expect(code).toContain('rel: "canonical"');
      expect(code).toContain("if (!result) throw notFound()");
      expect(code).toContain("PublicSeoDirectory");
    }
  });
});


describe("dedicated SSR SEO Vitest suites (isolated CI regression)", () => {
  it("runs the complete route, canonical, sitemap index and HTTP handler suites", () => {
    // GitHub's path-filtered workflow is not dispatched on this isolated PR.
    // Run these standalone Vitest files in a separate process to avoid
    // shared hoisted mock state with technician lookup tests.
    const files = [
      "src/lib/public-seo-graph.test.ts",
      "src/lib/public-sitemap.test.ts",
      "src/lib/seo-public-pages.test.ts",
      "src/lib/public-sitemap-index.test.ts",
      "src/lib/public-sitemap-http.test.ts",
      "src/components/public-seo-discovery.ssr.test.tsx",
      "src/routes/public-seo-routes.test.tsx",
      "src/components/public-technician-profile.test.tsx",
    ];
    const check = spawnSync("bunx", ["vitest", "run", ...files], {
      cwd: process.cwd(), encoding: "utf8", timeout: 90_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (check.status !== 0) {
      throw new Error("Standalone SEO suites failed (" + (check.status ?? "spawn error") +
        "): " + (check.error?.message ?? "") +
        "\\n" + (check.stdout || "").slice(-18_000) +
        "\\n" + (check.stderr || "").slice(-12_000));
    }
    const summary = (check.stdout || "").split("\n")
      .filter(line => /Test Files|Tests |src\/(?:lib|routes|components)\//.test(line));
    console.info("Isolated SEO suites passed:", summary.join(" | ").slice(0, 3000));
  }, 100_000);
});
