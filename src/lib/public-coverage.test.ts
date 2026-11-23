import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { groupPublishedCoverage } from "./public-coverage";

describe("cobertura real a partir de perfis públicos", () => {
  it("organiza apenas localidade + UF de perfis com slug válido, sem inventar deslocamento", () => {
    const result = groupPublishedCoverage([
      { state_uf: "PR", city: "Jardim Alegre", public_slug: "profissional-jardim-alegre-pr", display_name: "Técnico Exemplo" },
      { state_uf: "SP", city: "Ribeirão preto", public_slug: "tecnico-ribeirao-preto-sp", display_name: "Profissional Dois" },
      { state_uf: "SP", city: "Ribeirao Preto", public_slug: "outro-ribeirao-preto-sp", display_name: "Profissional Três" },
      { state_uf: "PR", city: "Jardim Alegre", public_slug: "profissional-jardim-alegre-pr", display_name: "Duplicado" },
      { state_uf: "PA", city: "Redenção", public_slug: "../admin", display_name: "Não publicado" },
      { state_uf: "XX", city: "Cidade imaginária", public_slug: "tecnico-xx", display_name: "Não publicado" },
      { state_uf: "PA", city: "41 99999 9999", public_slug: "local-falso", display_name: "Não publicado" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]?.uf).toBe("PR");
    expect(result[0]?.profiles).toHaveLength(1);
    expect(result[1]?.city).toBe("Ribeirão preto");
    expect(result[1]?.profiles).toHaveLength(2);
    expect(result.flatMap(x => x.profiles).map(x => x.slug)).not.toContain("../admin");
  });
  it("não divulga telefones ou links inseridos no nome profissional", () => {
    const rows = groupPublishedCoverage([
      { state_uf: "SC", city: "Tubarão", public_slug: "exemplo-tubarao-sc",
        display_name: "Empresa (48) 99999-9999" },
    ]);
    expect(rows[0]?.profiles[0]?.displayName).toBe("Profissional cadastrado");
    expect(JSON.stringify(rows)).not.toContain("99999");
  });
  it("reutiliza o grafo público elegível que inclui a tabela e a RPC administrativa", () => {
    const source = readFileSync("src/lib/public-coverage.functions.ts", "utf8");
    const graph = readFileSync("src/lib/public-seo-graph.functions.ts", "utf8");
    expect(source).toContain("getPublicGraphSnapshot()");
    expect(source).toContain("groupPublishedCoverage(graph.profiles)");
    expect(source).toContain("publishedCount: graph.profiles.length");
    expect(graph).toContain('.eq("status", "aprovado")');
    expect(graph).toContain("readPublicEligibleRows(");
    expect(graph).toContain('rpc("eut_public_admin_technicians"');
    expect(source).not.toMatch(/SERVICE_ROLE|private_contacts|contact_phone|auth\.users/i);
  });
  it("consolida perfis das duas fontes sem inventar localidades nem duplicar slugs", () => {
    const locations = groupPublishedCoverage([
      { state_uf: "PR", city: "Curitiba", public_slug: "tecnico-exemplo-pr", display_name: "Primeira origem" },
      { state_uf: "PR", city: "Curitiba", public_slug: "tecnico-exemplo-pr", display_name: "Registro repetido" },
      { state_uf: "SC", city: "Tubarão", public_slug: "tecnico-exemplo-sc", display_name: "Segunda origem" },
      { state_uf: null, city: "", public_slug: "tecnico-sem-cidade", display_name: "Sem cidade-base" },
    ]);
    expect(locations).toHaveLength(2);
    expect(locations.reduce((sum, location) => sum + location.profiles.length, 0)).toBe(2);
    expect(locations.map((location) => location.city)).toEqual(["Curitiba", "Tubarão"]);
  });
  it("inclui links para busca e perfis, declara limites e mantém canonical oficial", () => {
    const route = readFileSync("src/routes/cobertura.tsx", "utf8");
    expect(route).toContain('createFileRoute("/cobertura")');
    expect(route).toContain('rel: "canonical", href: SITE + "/cobertura"');
    expect(route).toContain('to="/tecnicos/$tecnicoId"');
    expect(route).toContain('cidade: location.city');
    expect(route).toContain("A localidade é informada pelo próprio profissional");
    expect(route).toContain("publishedCount");
    expect(route).toContain("locatedCount");
    expect(readFileSync("src/components/national-coverage.tsx", "utf8")).toContain("cidades para pesquisa");
    const sitemap = readFileSync("src/lib/public-sitemap.ts", "utf8");
    expect(sitemap).toContain('"/cobertura"');
    expect(readFileSync("src/components/site-footer.tsx", "utf8")).toContain('to="/cobertura"');
  });
});
