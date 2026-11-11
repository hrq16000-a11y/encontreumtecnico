import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPublicGraph, profilesInCategory, profilesInCity, relatedGraphProfiles, type GraphProfile } from "@/lib/public-seo-graph";
import { buildPublicSitemapIndexXml, buildPublicSitemapPartXml, listPublicSitemapParts } from "@/lib/public-sitemap-index";
import { PublicSeoDirectory, PublicProfileConnections } from "@/components/public-seo-discovery";
import { readPublicEligibleRows, type PublicEligibilityRpc } from "@/lib/public-eligibility";

type Status = "aprovado" | "pendente" | "suspenso" | "reprovado";
/** These identities/phone numbers are synthetic, never read from Supabase. */
type SyntheticTechnician = GraphProfile & {
  status: Status;
  syntheticOwner: string;
  syntheticPhone: string;
};

const make = (slug: string, status: Status, city: string, uf: string, category: string): SyntheticTechnician => ({
  public_slug: slug,
  display_name: "Profissional de testes",
  city,
  state_uf: uf,
  specialties: [category],
  service_slugs: ["instalacao-rede"],
  status,
  syntheticOwner: "qa-owner-" + slug,
  syntheticPhone: "00000000000",
});

const source = [
  make("qa-rede-curitiba", "aprovado", "Curitiba", "PR", "redes"),
  make("qa-rede-curitiba-2", "aprovado", "Curitiba", "PR", "redes"),
  make("qa-cftv-sao-paulo", "aprovado", "São Paulo", "SP", "cftv"),
  make("qa-pendente", "pendente", "São Paulo", "SP", "redes"),
  make("qa-reprovado", "reprovado", "São Paulo", "SP", "redes"),
];
const cities = [{ name: "Curitiba", uf: "PR" }, { name: "São Paulo", uf: "SP" }];
const categories = [{ slug: "redes", label: "Redes" }, { slug: "cftv", label: "Câmeras" }];

/**
 * Mirrors the existing SELECT + RLS approval condition, not a database
 * mutation. Deliberately does NOT simulate a ban filter that does not exist.
 */
const graphFromApproved = (rows: SyntheticTechnician[]) =>
  buildPublicGraph(rows.filter(row => row.status === "aprovado"), cities, categories);

const urls = (xml: string | null) => [...(xml ?? "").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1] ?? "");

describe("SEO público: simulação não destrutiva de suspensão e atualização", () => {
  it("exige filtro real de status aprovado nas fontes de perfil e sitemap", () => {
    const graphSource = readFileSync("src/lib/public-seo-graph.functions.ts", "utf8");
    const profileSource = readFileSync("src/lib/technicians.functions.ts", "utf8");
    expect(graphSource).toContain('.eq("status", "aprovado")');
    expect(profileSource).toContain('.eq("status", "aprovado")');
    expect(graphSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(profileSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("exclui pendentes e reprovados de perfil, categoria, cidade e XML", () => {
    const graph = graphFromApproved(source);
    const serialized = [
      JSON.stringify(graph),
      buildPublicSitemapIndexXml(graph),
      ...(["base", "cidades", "categorias", "tecnicos"] as const)
        .map(kind => buildPublicSitemapPartXml(graph, kind, kind === "tecnicos" ? 1 : undefined)),
    ].join(" ");
    for (const hidden of ["qa-pendente", "qa-reprovado", "qa-owner-qa-pendente", "00000000000"]) {
      expect(serialized).not.toContain(hidden);
    }
    expect(graph.profiles).toHaveLength(3);
    expect(graph.cities).toHaveLength(2);
  });

  it("retira perfil suspenso e cidade/categoria órfãs, com 404 por ausência de resultado", () => {
    const before = graphFromApproved(source);
    const suspended = source.map(row => row.public_slug === "qa-cftv-sao-paulo"
      ? { ...row, status: "suspenso" as const } : row);
    const after = graphFromApproved(suspended);
    const beforeXml = urls(buildPublicSitemapPartXml(before, "tecnicos", 1));
    const afterXml = urls(buildPublicSitemapPartXml(after, "tecnicos", 1));
    expect(beforeXml.some(url => url.endsWith("/tecnicos/qa-cftv-sao-paulo"))).toBe(true);
    expect(afterXml.some(url => url.endsWith("/tecnicos/qa-cftv-sao-paulo"))).toBe(false);
    expect(profilesInCity(after, "SP", "sao-paulo")).toHaveLength(0);
    expect(profilesInCategory(after, "cftv")).toHaveLength(0);
    expect(after.cities.some(city => city.uf === "SP")).toBe(false);
    expect(after.categories.some(cat => cat.slug === "cftv")).toBe(false);
    expect(urls(buildPublicSitemapPartXml(after, "cidades")).some(url => url.includes("/sao-paulo"))).toBe(false);
    expect(urls(buildPublicSitemapPartXml(after, "categorias")).some(url => url.endsWith("/cftv"))).toBe(false);
    expect(listPublicSitemapParts(after)).toHaveLength(4); // base + remaining city/category + 1 technician page
  });

  it("remove links SSR de perfil suspenso e mantém apenas relações publicadas", () => {
    const suspended = graphFromApproved(source.map(row => row.public_slug === "qa-cftv-sao-paulo"
      ? { ...row, status: "suspenso" as const } : row));
    const directoryHtml = renderToStaticMarkup(createElement(PublicSeoDirectory, {
      heading: "Técnicos com publicação vigente",
      summary: "Somente perfis aprovados",
      profiles: suspended.profiles,
      cities: suspended.cities,
      categories: suspended.categories,
    }));
    const current = suspended.profiles.find(p => p.public_slug === "qa-rede-curitiba")!;
    const related = relatedGraphProfiles(suspended, current);
    const links = renderToStaticMarkup(createElement(PublicProfileConnections, {
      links: { city: suspended.cities[0] ?? null, categories: suspended.categories, related },
    }));
    expect(directoryHtml).toContain('href="/tecnicos/qa-rede-curitiba"');
    expect(links).toContain('href="/tecnicos/qa-rede-curitiba-2"');
    for (const rendered of [directoryHtml, links]) {
      expect(rendered).not.toContain("qa-cftv-sao-paulo");
      expect(rendered).not.toContain("qa-pendente");
      expect(rendered).not.toContain("qa-reprovado");
      expect(rendered).not.toContain("00000000000");
    }
  });
});

describe("Elegibilidade pública moderada: simulação RPC sem SQL real", () => {
  const mockGate = (blocked: Set<string>): PublicEligibilityRpc => ({
    rpc: async (name, args) => ({
      data: name === "eut_public_eligible_technician_ids"
        ? args._ids.filter(id => !blocked.has(id)).map(technician_id => ({ technician_id })) : null,
      error: name === "eut_public_eligible_technician_ids" ? null : { message: "Unknown RPC" },
    }),
  });

  it("retira o técnico banido por conta ainda aprovado de grafo, interlinks e sitemap", async () => {
    const blocked = make("qa-banido-uuid", "aprovado", "Curitiba", "PR", "redes");
    const all = [...source, blocked].map(p => ({ ...p, id: "qa-" + p.public_slug }));
    const eligible = await readPublicEligibleRows(mockGate(new Set(["qa-" + blocked.public_slug])), all.filter(p => p.status === "aprovado"));
    const graph = buildPublicGraph(eligible, cities, categories);
    expect(graph.profiles.some(p => p.public_slug === blocked.public_slug)).toBe(false);
    const xml = buildPublicSitemapPartXml(graph, "tecnicos", 1);
    expect(xml).not.toContain("/tecnicos/qa-banido-uuid");
    const current = graph.profiles.find(p => p.public_slug === "qa-rede-curitiba")!;
    expect(relatedGraphProfiles(graph, current).some(p => p.public_slug === blocked.public_slug)).toBe(false);
  });

  it("retira técnico com telefone banido do sitemap mesmo que aprovado", async () => {
    const blocked = make("qa-banido-telefone", "aprovado", "Curitiba", "PR", "redes");
    const all = [...source, blocked].map(p => ({ ...p, id: "qa-" + p.public_slug }));
    const eligible = await readPublicEligibleRows(mockGate(new Set(["qa-" + blocked.public_slug])), all.filter(p => p.status === "aprovado"));
    const graph = buildPublicGraph(eligible, cities, categories);
    expect(buildPublicSitemapPartXml(graph, "tecnicos", 1)).not.toContain("/tecnicos/qa-banido-telefone");
  });

  it("falha fechado se o RPC ainda não existe ou estiver indisponível", async () => {
    const rows = [{ id: "qa-id", display_name: "Técnico", status: "aprovado" }];
    const errors = [
      { data: null, error: { code: "PGRST202" } },
      { data: null, error: null },
      { data: [{ wrong: true }], error: null },
    ];
    for (const result of errors) {
      await expect(readPublicEligibleRows({ rpc: async () => result }, rows))
        .rejects.toThrow(/eligibility unavailable|Invalid public eligibility response/);
    }
  });

  it("exige backend/RLS com bloqueio por conta e telefone, sem exposição de listas", () => {
    const migration = readFileSync("docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql", "utf8");
    const adapter = readFileSync("src/lib/public-eligibility.ts", "utf8");
    const list = readFileSync("src/lib/technicians.functions.ts", "utf8");
    const graph = readFileSync("src/lib/public-seo-graph.functions.ts", "utf8");
    expect(migration).toContain("eut_moderation.blocked_accounts");
    expect(migration).toContain("eut_moderation.blocked_phones");
    expect(migration).toContain("eut_technician_private_contacts");
    expect(migration).toContain("DROP POLICY IF EXISTS");
    expect(adapter).toContain("eut_public_eligible_technician_ids");
    expect(list.match(/readPublicEligibleRows\(/g)).toHaveLength(2);
    expect(graph).toContain("readPublicEligibleRows(");
    expect(adapter).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
  it("reconsulta elegibilidade após uma revogação sem reutilizar decisão anterior", async () => {
    const blocked = new Set<string>();
    const seen = { calls: 0 };
    const client: PublicEligibilityRpc = {
      rpc: async (_name, args) => {
        seen.calls++;
        return { data: args._ids.filter(id => !blocked.has(id))
          .map(technician_id => ({ technician_id })), error: null };
      },
    };
    const candidate = [{ id: "qa-owner-virtual", public_slug: "qa-moderado" }];
    const first = await readPublicEligibleRows(client, candidate);
    expect(first).toHaveLength(1);
    blocked.add(candidate[0]!.id);
    const second = await readPublicEligibleRows(client, candidate);
    expect(second).toHaveLength(0);
    expect(seen.calls).toBe(2);
  });

  it("não retém grafo de técnicos na memória e proíbe cache de SSR/XML", () => {
    const graph = readFileSync("src/lib/public-seo-graph.functions.ts", "utf8");
    const profile = readFileSync("src/lib/technicians.functions.ts", "utf8");
    const xml = readFileSync("src/lib/public-sitemap-http.ts", "utf8");
    const sitemapIndex = readFileSync("src/routes/sitemap[.]xml.ts", "utf8");
    expect(graph).toContain("return loadGraphUncached();");
    expect(graph).not.toContain("let cached: Promise<GraphCatalog>");
    expect(graph).toContain("REFERENCE_CATALOG_CACHE_MS");
    expect(graph).toContain('setResponseHeader("Cache-Control", "no-store")');
    expect(profile).toContain('setResponseHeader("Cache-Control", "no-store")');
    expect(xml).toContain('"Vercel-CDN-Cache-Control": "no-store"');
    expect(sitemapIndex).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(xml).not.toContain("stale-while-revalidate");
  });

  it("limita RPC a 500 IDs por lote e nunca agrega IDs que não foram solicitados", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: "qa-batch-" + i }));
    const rpc = vi.fn(async (_name: string, params: { _ids: string[] }) => ({
      data: [...params._ids.map(technician_id => ({ technician_id })), { technician_id: "qa-nao-solicitado" }],
      error: null,
    }));
    const filtered = await readPublicEligibleRows({ rpc }, rows);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]._ids).toHaveLength(500);
    expect(rpc.mock.calls[1]?.[1]._ids).toHaveLength(1);
    expect(filtered).toHaveLength(501);
    expect(filtered.some(row => row.id === "qa-nao-solicitado")).toBe(false);
  });

});
