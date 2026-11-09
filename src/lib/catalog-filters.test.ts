import { describe, expect, it } from "vitest";
import { normalizeCatalogSelection, resolveCatalogLabels } from "./catalog-filters";
const catalog = {
  categories: [{ slug:"computadores",label:"Computadores e notebooks" }, {slug:"cftv",label:"Câmeras e segurança eletrônica"}],
  services: [
    {slug:"manutencao-pc",category_slug:"computadores",label:"Manutenção de computadores"},
    {slug:"manutencao-notebook",category_slug:"computadores",label:"Manutenção de notebooks"},
    {slug:"instalacao-cameras",category_slug:"cftv",label:"Instalação de câmeras"},
  ],
};
describe("catálogo público gerenciável", () => {
  it("reconcilia categorias antigas sem classificar tudo como TI", () => {
    expect(resolveCatalogLabels("Computador",catalog)).toEqual(["Manutenção de computadores","Manutenção de notebooks"]);
    expect(resolveCatalogLabels("CFTV",catalog)).toEqual(["Instalação de câmeras"]);
    expect(resolveCatalogLabels("TI - Informática",catalog)).toEqual([]);
    expect(normalizeCatalogSelection("CFTV",catalog)).toBe("cat:cftv");
  });
  it("filtra serviço específico e bloqueia slugs inválidos", () => {
    expect(resolveCatalogLabels("svc:manutencao-pc",catalog)).toEqual(["Manutenção de computadores"]);
    expect(resolveCatalogLabels("svc:desativado",catalog)).toEqual([]);
    expect(resolveCatalogLabels("cat:inexistente",catalog)).toEqual([]);
    expect(normalizeCatalogSelection("svc:desativado",catalog)).toBe("Todas");
  });
  it("sem filtro mantém a regra de aprovados do servidor", () => {
    expect(resolveCatalogLabels("Todas",catalog)).toBeNull();
    expect(resolveCatalogLabels("",catalog)).toBeNull();
  });
});
