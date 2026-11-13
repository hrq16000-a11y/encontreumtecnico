import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hydrateTechnicianOfficialCity } from "./technician-official-city-hydration";
import { registrationStepError } from "./technician-registration-wizard";

const cities = [
  { id: 4125506, name: "São José dos Pinhais", uf: "PR" },
  { id: 4106902, name: "Curitiba", uf: "PR" },
  { id: 1200203, name: "Cruzeiro do Sul", uf: "AC" },
];
const catalog = {
  categories: [{ slug: "computadores" }],
  services: [{ slug: "formatacao", category_slug: "computadores" }],
  catalogLoading: false, catalogError: false, servicesLoading: false, servicesError: false,
};
const restored = {
  display_name: "Técnico de informática", state_uf: "PR", city: "Sao Jose dos Pinhais",
  neighborhood: "Jardim Itália", region: "", bio: "Atendo em São José dos Pinhais",
  specialties: ["computadores"], service_slugs: ["formatacao"], base_city_ibge_id: null,
};

describe("P0 técnico: rascunho restaurado não perde cidade oficial na etapa 3", () => {
  it("reconhece somente correspondência exata no catálogo oficial da mesma UF", () => {
    const result = hydrateTechnicianOfficialCity(restored, cities, "PR");
    expect(result.base_city_ibge_id).toBe(4125506);
    expect(result.city).toBe(restored.city);
    expect(result.neighborhood).toBe("Jardim Itália");
    expect(result.specialties).toEqual(restored.specialties);
    expect(registrationStepError(1, result, catalog)).toBeNull();
    expect(registrationStepError(3, result, catalog)).toBeNull();
  });
  it("não altera seleção manual e retorna a mesma referência se houver ID", () => {
    const chosen = { ...restored, base_city_ibge_id: 4106902 };
    expect(hydrateTechnicianOfficialCity(chosen, cities, "PR")).toBe(chosen);
  });
  it("não inventa cidade, não reutiliza lista de UF anterior nem assume aproximação", () => {
    for (const [input, uf, source] of [
      [restored, "AC", cities],
      [{ ...restored, city: "Grande Curitiba" }, "PR", cities],
      [{ ...restored, city: "" }, "PR", cities],
      [{ ...restored, state_uf: "AC" }, "AC", cities],
      [restored, "PR", [
        { id: 4125506, name: "São José dos Pinhais", uf: "PR" },
        { id: 4125507, name: "São José dos Pinhais", uf: "PR" },
      ]],
    ] as const) {
      expect(hydrateTechnicianOfficialCity(input, source, uf)).toBe(input);
    }
  });
  it("a hidratação fica fora da etapa 1 e só é aplicada após recuperar o dono", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain("hydrateTechnicianOfficialCity");
    expect(route).toContain("draftRestoredOwnerId !== user.id");
    expect(route).toContain("setForm(current => currentUserRef.current === owner");
    expect(route).toContain("? hydrateTechnicianOfficialCity(current, officialBaseCities, form.state_uf)");
    expect(route).toContain('activationDb.rpc("eut_publish_my_technician"');
  });
});
