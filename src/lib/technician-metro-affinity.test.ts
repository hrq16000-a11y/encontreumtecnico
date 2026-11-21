import { describe, expect, it } from "vitest";
import { hasSameMetropolitanCore } from "./technician-metro-affinity";
import { rankTechniciansByDeclaredArea, type AreaTechnician } from "./technician-local-ranking";

const tech = (id: string, city: string, uf: string, online = false): AreaTechnician & { id: string } => ({
  id, city, state_uf: uf, neighborhood: null,
  online_now: online, coverage_cities: [], covers_entire_state: false,
});

describe("same-metro tie-break (Preciso de Um concept, no GPS)", () => {
  it("recognizes the Curitiba metro but not distant municipalities or other states", () => {
    expect(hasSameMetropolitanCore({ queryUf: "PR", queryCity: "São José dos Pinhais", technicianUf: "PR", technicianCity: "Curitiba" })).toBe(true);
    expect(hasSameMetropolitanCore({ queryUf: "PR", queryCity: "Curitiba", technicianUf: "PR", technicianCity: "Londrina" })).toBe(false);
    expect(hasSameMetropolitanCore({ queryUf: "PR", queryCity: "Curitiba", technicianUf: "SC", technicianCity: "São José" })).toBe(false);
    expect(hasSameMetropolitanCore({ queryUf: "", queryCity: "Curitiba", technicianUf: "PR", technicianCity: "Pinhais" })).toBe(false);
  });

  it("keeps declared same-city coverage first; metro core beats online in distant same-UF cities", () => {
    const ranked = rankTechniciansByDeclaredArea([
      tech("lon", "Londrina", "PR", true),
      tech("cur", "Curitiba", "PR"),
      tech("sao", "São José dos Pinhais", "PR"),
      tech("sc", "Joinville", "SC", true),
    ], { uf: "PR", cidade: "São José dos Pinhais", bairro: "" });
    expect(ranked.map(t => t.id)).toEqual(["sao", "cur", "lon", "sc"]);
  });

  it("never invents confirmed coverage just because the base city shares a metro", () => {
    const inMetro = tech("p", "Pinhais", "PR");
    const area = { uf: "PR", cidade: "Curitiba", bairro: "" };
    // The existing local-match contract remains 'same state', not 'serves Curitiba'.
    const ranked = rankTechniciansByDeclaredArea([tech("l", "Londrina", "PR"), inMetro], area);
    expect(ranked.map(t => t.id)).toEqual(["p", "l"]);
  });

  it("preserves original order when no verified UF/city context exists", () => {
    const rows = [tech("a", "Londrina", "PR"), tech("b", "Curitiba", "PR")];
    expect(rankTechniciansByDeclaredArea(rows, { uf: "", cidade: "", bairro: "" }).map(t => t.id)).toEqual(["a", "b"]);
  });
});
