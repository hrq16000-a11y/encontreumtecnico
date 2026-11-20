import { describe, expect, it } from "vitest";
import { automaticRegionalRankingArea, parseVercelRegion, getSavedRegionalHint, rememberRegionalHint } from "./regional-suggestion";

describe("Contexto regional sem dados precisos", () => {
  it("aceita município brasileiro por IP e nunca inventa bairro", () => {
    expect(parseVercelRegion({ country: "BR", state: "PR", city: "S%C3%A3o%20Jos%C3%A9%20dos%20Pinhais" }))
      .toEqual({ city: "São José dos Pinhais", uf: "PR", neighborhood: "", source: "ip" });
    expect(parseVercelRegion({ country: "US", state: "PR", city: "Curitiba" })).toBeNull();
    expect(parseVercelRegion({ country: "BR", state: "XX", city: "Curitiba" })).toBeNull();
    expect(parseVercelRegion({ country: "BR", state: "PR", city: "<script>" })).toBeNull();
  });
  it("expira em 6h, armazena só cidade/UF e mantém GPS já autorizado", () => {
    const storage = window.sessionStorage;
    storage.clear();
    const now = 100000;
    expect(rememberRegionalHint({ city: "Curitiba", uf: "PR", neighborhood: "Fake", source: "ip" }, storage, now)).toBe(true);
    expect(getSavedRegionalHint(storage, now)?.neighborhood).toBe("");
    expect(getSavedRegionalHint(storage, now + 6 * 60 * 60 * 1000 + 1)).toBeNull();
    expect(rememberRegionalHint({ city: "Pinhais", uf: "PR", neighborhood: "Centro", source: "gps" }, storage, now)).toBe(true);
    expect(rememberRegionalHint({ city: "Curitiba", uf: "PR", neighborhood: "", source: "ip" }, storage, now + 1)).toBe(false);
    expect(getSavedRegionalHint(storage, now + 1)?.city).toBe("Pinhais");
  });
  it("usa IP só para ordenar resultados sem filtros manuais, nunca GPS ou bairro presumido", () => {
    const empty = { uf: "", cidade: "", bairro: "", regiao: "" };
    const ip = parseVercelRegion({ country: "BR", state: "PR", city: "Curitiba" });
    expect(automaticRegionalRankingArea(empty, ip)).toEqual({ uf: "PR", cidade: "Curitiba", bairro: "" });
    expect(automaticRegionalRankingArea({ ...empty, uf: "SC" }, ip)).toBeNull();
    expect(automaticRegionalRankingArea({ ...empty, cidade: "Tubarão" }, ip)).toBeNull();
    expect(automaticRegionalRankingArea({ ...empty, bairro: "Centro" }, ip)).toBeNull();
    expect(automaticRegionalRankingArea({ ...empty, regiao: "Zona Norte" }, ip)).toBeNull();
    expect(automaticRegionalRankingArea(empty, { city: "Curitiba", uf: "PR", neighborhood: "Centro", source: "gps" })).toBeNull();
    expect(automaticRegionalRankingArea(empty, null)).toBeNull();
    expect(automaticRegionalRankingArea(empty, { city: "Cidade fictícia", uf: "XX", neighborhood: "", source: "ip" })).toBeNull();
  });
});
