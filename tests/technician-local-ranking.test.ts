import { describe, expect, test } from "bun:test";
import { localMatchLabel, localMatchLevel, rankTechniciansByDeclaredArea } from "../src/lib/technician-local-ranking";

type TestTechnician = {
  id: string;
  state_uf: string | null;
  city: string;
  neighborhood: string | null;
  online_now: boolean;
};

const person = (id: string, state_uf: string, city: string, neighborhood: string, online_now: boolean): TestTechnician =>
  ({ id, state_uf, city, neighborhood, online_now });

describe("Declared-area relevance is not a GPS distance or a quality score", () => {
  const area = { uf: "PR", cidade: "São José dos Pinhais", bairro: "Afonso Pena" };

  test("prioritizes exact neighborhood, city, UF, then others before online", () => {
    const candidates = [
      person("other-online", "SC", "Florianópolis", "Centro", true),
      person("same-uf-online", "PR", "Curitiba", "Centro", true),
      person("same-city-offline", "PR", "São José dos Pinhais", "Costeira", false),
      person("same-neighborhood-offline", "PR", "São José dos Pinhais", "Afonso Pena", false),
      person("same-neighborhood-online", "PR", "São José dos Pinhais", "Afonso Pena", true),
      person("other-offline", "SP", "São Paulo", "Centro", false),
    ];
    expect(rankTechniciansByDeclaredArea(candidates, area).map((t) => t.id)).toEqual([
      "same-neighborhood-online","same-neighborhood-offline","same-city-offline",
      "same-uf-online","other-online","other-offline",
    ]);
  });

  test("does not confuse identically named cities in different states", () => {
    const candidate = person("wrong-state","SC","São José dos Pinhais","Afonso Pena",true);
    expect(localMatchLevel(candidate, area)).toBe(0);
    expect(localMatchLabel(candidate, area)).toBeNull();
  });

  test("never treats a repeated neighborhood name in another city as nearby", () => {
    const candidate = person("wrong-city","PR","Curitiba","Afonso Pena",true);
    expect(localMatchLevel(candidate, area)).toBe(1);
  });

  test("normalizes accents and case and keeps original order on a tie", () => {
    const a=person("a","pr","Sao Jose dos Pinhais","afonso  pena",false);
    const b=person("b","PR","SÃO JOSÉ DOS PINHAIS","Afonso Pena",false);
    expect(localMatchLevel(a,area)).toBe(3);
    expect(rankTechniciansByDeclaredArea([a,b],area).map(t=>t.id)).toEqual(["a","b"]);
  });

  test("does not pretend a city is nearby when only a neighborhood matches", () => {
    const candidate=person("same-bairro-different-city","SP","Campinas","Centro",false);
    expect(localMatchLevel(candidate,{uf:"",cidade:"",bairro:"Centro"})).toBe(0);
  });
});
