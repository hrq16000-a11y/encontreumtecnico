import { describe, expect, it } from "vitest";
import {
  CAPITAL_CITIES,
  PARTNER_CITIES_BY_STATE,
  PARTNER_CITY_COUNT,
  DISTINCT_COVERAGE_CITY_COUNT,
} from "./national-coverage";

describe("cobertura nacional informativa", () => {
  it("inclui as 27 capitais e Brasília", () => {
    expect(CAPITAL_CITIES).toHaveLength(27);
    expect(new Set(CAPITAL_CITIES.map(({ uf }) => uf)).size).toBe(27);
    expect(CAPITAL_CITIES).toContainEqual({ uf: "DF", cidade: "Brasília" });
  });

  it("preserva as 79 localidades parceiras informadas em 22 UFs", () => {
    expect(Object.keys(PARTNER_CITIES_BY_STATE)).toHaveLength(22);
    expect(PARTNER_CITY_COUNT).toBe(79);
    for (const [uf, cidades] of Object.entries(PARTNER_CITIES_BY_STATE)) {
      expect(new Set(cidades).size, "localidade duplicada em " + uf).toBe(cidades.length);
    }
  });

  it("não duplica capitais também presentes na relação de parceiros no total de localidades", () => {
    expect(DISTINCT_COVERAGE_CITY_COUNT).toBe(102);
  });
});
