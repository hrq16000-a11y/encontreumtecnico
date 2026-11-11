import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { neighborhoodCatalogFor, neighborhoodOptions } from "./neighborhood-sources";
import { safeNeighborhood } from "./location-labels";

const read = (file: string) => readFileSync(file, "utf8");

describe("Bairros sugeridos apenas com fonte municipal identificada", () => {
  it("associa São José dos Pinhais/PR ao município IBGE 4125506", () => {
    const catalog = neighborhoodCatalogFor({
      city: "Sao Jose dos Pinhais", uf: "pr", municipalityIbgeId: 4125506,
    });
    expect(catalog?.municipalityName).toBe("São José dos Pinhais");
    expect(catalog?.sourceUrl).toBe("https://www.sjp.pr.gov.br/mapas-do-municipio/");
    expect(neighborhoodOptions(catalog)).toContain("Itália");
    expect(neighborhoodOptions(catalog)).toContain("Centro");
    expect(neighborhoodOptions(catalog)).toContain("Afonso Pena");
    expect(neighborhoodOptions(catalog).length).toBeGreaterThanOrEqual(35);
  });

  it("oferece somente nomes conferidos na planilha SIGMU da Prefeitura de Curitiba", () => {
    const catalog = neighborhoodCatalogFor({
      city: "Curitiba", uf: "PR", municipalityIbgeId: 4106902,
    });
    expect(catalog?.sourceUrl).toContain("dadosabertos.curitiba.pr.gov.br");
    const options = neighborhoodOptions(catalog);
    expect(options).toHaveLength(19);
    expect(options).toContain("Água Verde");
    expect(options).toContain("Jardim Botânico");
    expect(options).toContain("Tarumã");
    expect(options).not.toContain("Jardim Itália");
    expect(neighborhoodCatalogFor({
      city: "Curitiba", uf: "PR", municipalityIbgeId: 4125506,
    })).toBeNull();
  });

  it("nunca sugere um bairro de São José dos Pinhais para outros municípios", () => {
    for (const value of [
      { city: "Pinhais", uf: "PR" },
      { city: "São José dos Pinhais", uf: "SP" },
      { city: "São José dos Pinhais", uf: "" },
      { city: "", uf: "PR" },
      { city: "São José dos Pinhais", uf: "PR", municipalityIbgeId: 4106902 },
    ]) expect(neighborhoodCatalogFor(value)).toBeNull();
    expect(neighborhoodOptions(null)).toEqual([]);
  });

  it("não trata ausência no catálogo como erro ou tenta adivinhar Jardim Itália", () => {
    const official = neighborhoodOptions(neighborhoodCatalogFor({ city: "São José dos Pinhais", uf: "PR" }));
    expect(official).not.toContain("Jardim Itália");
    expect(official).toContain("Itália");
    expect(safeNeighborhood("Jardim Itália", "São José dos Pinhais")).toBe("Jardim Itália");
    expect(safeNeighborhood("São José dos Pinhais", "São José dos Pinhais")).toBe("");
  });

  it("garante sugestão opcional, sem sobrescrever rascunho, GPS ou município oficial", () => {
    const profile = read("src/routes/area-tecnico.tsx");
    const directory = read("src/routes/tecnicos.index.tsx");
    const input = read("src/components/debounced-text-filter.tsx");
    const home = read("src/routes/index.tsx");
    const lp2 = read("src/routes/lp2/index.tsx");
    const gallery = read("src/routes/lp2/galeria.tsx");
    const card = read("src/components/technician-search-card.tsx");
    const detail = read("src/components/public-technician-profile.tsx");
    expect(profile).toContain('list={bairroCatalog ? "eut-bairro-profissional" : undefined}');
    expect(profile).toContain("placeholder=\"Ex.: Jardim Itália\"");
    expect(profile).toContain("onChange={(e) => updateRegistration({ ...form, neighborhood: e.target.value })}");
    expect(profile).toContain("saveTechnicianDraftImmediately");
    expect(profile).toContain("eut_publish_my_technician");
    expect(profile).toContain("base_city_ibge_id");
    expect(directory).toContain("neighborhoodCatalogFor({ city: search.cidade, uf: search.uf })");
    expect(directory).toContain('list={bairroCatalog ? "eut-bairro-diretorio" : undefined}');
    expect(input).toContain("list?: string");
    expect(input).toContain("savePendingFilter");
    expect(home).toContain('placeholder="Município (ex.: São José dos Pinhais)"');
    expect(home).toContain('setLocationNeighborhood(""); // IP cannot establish a neighborhood.');
    expect(lp2).toContain("Município (opcional)");
    expect(gallery).toContain("Município (ex.: Curitiba)");
    expect(card).toContain("formatPublicLocation(t)");
    expect(detail).toContain("formatPublicLocation(t)");
  });

  it("não cria rede de terceiros, perfis fictícios ou dados privados em cliente", () => {
    const source = read("src/lib/neighborhood-sources.ts");
    const profile = read("src/routes/area-tecnico.tsx");
    expect(source).not.toMatch(/fetch\(|axios\.|\.from\(|auth\.admin|service_role/i);
    expect(source).not.toContain("Jardim Itália\",");
    expect(profile).toContain("safeNeighborhood(form.neighborhood, form.city)");
    expect(profile).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
