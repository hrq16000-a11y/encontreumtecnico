import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("src/routes/index.tsx", "utf8");
const rich = readFileSync("src/components/home-rich.tsx", "utf8");

describe("R4 — busca editorial e conteúdo da home", () => {
  it("mantém a recuperação do rascunho, rótulos permanentes e alternativa ao diretório", () => {
    expect(home).toContain('htmlFor="busca-especialidade"');
    expect(home).toContain('<SearchMunicipalityChoice');
    expect(home).not.toMatch(/className="sr-only" htmlFor="busca-/);
    expect(home).toContain('id="busca-especialidade"');
    expect(home).toContain('id="busca-cidade"');
    expect(home).toContain("Recuperando sua busca");
    expect(home).toContain("Abrir diretório de técnicos");
    expect(home).toContain('readUiTextDraft("home")');
    expect(home).toContain('cityEditedByUser.current = true');
    expect(home).toContain('uf: locationUf, bairro: locationNeighborhood, prioridade: locationUf ? "regiao" : ""');
    expect(home).toContain('window.__lovableEvents?.track?.("project.technician_search"');
  });

  it("torna as sugestões acionáveis usando as mesmas categorias do diretório", () => {
    for (const slug of ["cftv", "computadores", "redes", "impressoras"]) {
      expect(home).toContain('value: "' + slug + '"');
      expect(home).toContain('slug: "' + slug + '"');
    }
    expect(home).toContain('role="group" aria-label="Sugestões de especialidades"');
    expect(home).toContain('type="button" aria-pressed={specialty === value}');
    expect(home).toContain('saveUiTextDraft("home", { specialty:value, city, uf:locationUf, neighborhood:locationNeighborhood })');
  });

  it("não oculta seções importantes antes de scroll nem anima o hero continuamente", () => {
    expect(home).not.toContain("<Reveal>");
    expect(home).not.toContain("animate-float");
    expect(home).not.toContain("animate-rise");
    for (const section of ["CategoryGrid", "HowItWorksRich", "CoverageSection", "ApprovalProcessSection", "FaqPreview", "ContactBand"]) {
      expect(home).toContain("<" + section + " />");
    }
    expect(home).toContain("duration-150");
    expect(home).toContain("motion-reduce:transition-none");
    expect(rich).not.toContain("group-hover:opacity-100");
  });
});
