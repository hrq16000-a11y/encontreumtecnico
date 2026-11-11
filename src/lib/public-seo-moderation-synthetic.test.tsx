import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPublicGraph, profilesInCategory, profilesInCity, relatedGraphProfiles, type GraphProfile } from "@/lib/public-seo-graph";
import { buildPublicSitemapIndexXml, buildPublicSitemapPartXml, listPublicSitemapParts } from "@/lib/public-sitemap-index";
import { PublicSeoDirectory, PublicProfileConnections } from "@/components/public-seo-discovery";

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

const urls = (xml: string | null) => [...(xml ?? "").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

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

describe("BLOQUEADOR DE PUBLICAÇÃO: banimento independente do status aprovado", () => {
  it("exige remover perfil de conta banida mesmo quando status continua aprovado", () => {
    const blockedAccount = make("qa-banido-uuid", "aprovado", "Curitiba", "PR", "redes");
    const blockedOwners = new Set([blockedAccount.syntheticOwner]);
    expect(blockedOwners.has(blockedAccount.syntheticOwner)).toBe(true);
    // Current graph receives only the approval-filtered rows, not an authorized
    // ban decision. A red assertion is deliberate evidence of the missing guard.
    const publicGraph = graphFromApproved([...source, blockedAccount]);
    expect(publicGraph.profiles.some(p => p.public_slug === blockedAccount.public_slug)).toBe(false);
  });

  it("exige remover perfil cujo contato privado corresponde a telefone banido", () => {
    const blockedPhone = make("qa-banido-telefone", "aprovado", "Curitiba", "PR", "redes");
    blockedPhone.syntheticPhone = "00000000001";
    const deniedDigits = new Set(["00000000001"]);
    expect(deniedDigits.has(blockedPhone.syntheticPhone)).toBe(true);
    // No private phone is ever read by browser/anon. The public query lacks
    // a safe server-side moderation signal, so it currently includes this row.
    const publicGraph = graphFromApproved([...source, blockedPhone]);
    const xml = buildPublicSitemapPartXml(publicGraph, "tecnicos", 1);
    expect(xml).not.toContain("/tecnicos/qa-banido-telefone");
  });
});
