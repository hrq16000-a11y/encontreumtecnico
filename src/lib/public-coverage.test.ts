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
  it("consulta somente perfis aprovados com dados públicos, paginados", () => {
    const source = readFileSync("src/lib/public-coverage.functions.ts", "utf8");
    expect(source).toContain('.select("public_slug,display_name,city,state_uf")');
    expect(source).toContain('.eq("status", "aprovado")');
    expect(source).toContain(".range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)");
    expect(source).toContain("throw new Error");
    expect(source).not.toMatch(/SERVICE_ROLE|private_contacts|contact_phone|auth\.users/i);
  });
  it("inclui links para busca e perfis, declara limites e mantém canonical oficial", () => {
    const route = readFileSync("src/routes/cobertura.tsx", "utf8");
    expect(route).toContain('createFileRoute("/cobertura")');
    expect(route).toContain('rel: "canonical", href: SITE + "/cobertura"');
    expect(route).toContain('to="/tecnicos/$tecnicoId"');
    expect(route).toContain('cidade: location.city');
    expect(route).toContain("A localidade é informada pelo próprio profissional");
    const sitemap = readFileSync("src/lib/public-sitemap.ts", "utf8");
    expect(sitemap).toContain('"/cobertura"');
    expect(readFileSync("src/components/site-footer.tsx", "utf8")).toContain('to="/cobertura"');
  });
});
