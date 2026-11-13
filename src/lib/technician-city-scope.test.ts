import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchingOfficialMunicipalityId } from "./technician-city-scope";
const ref = { id: 4125506, name: "São José dos Pinhais", uf: "PR" };
describe("busca na cobertura IBGE existente", () => {
  it("recusa município divergente e não infere a cidade por texto", () => {
    expect(matchingOfficialMunicipalityId("4125506", ref, "PR", "Sao Jose dos Pinhais")).toBe(4125506);
    expect(matchingOfficialMunicipalityId("4125506", ref, "SC", ref.name)).toBeNull();
    expect(matchingOfficialMunicipalityId("4106902", ref, "PR", ref.name)).toBeNull();
    expect(matchingOfficialMunicipalityId("4125506", ref, "PR", "Curitiba")).toBeNull();
    expect(matchingOfficialMunicipalityId("4125506", null, "PR", ref.name)).toBeNull();
    expect(matchingOfficialMunicipalityId("41%", ref, "PR", ref.name)).toBeNull();
  });
  it("usa os técnicos existentes, checa elegibilidade e oculta legado na busca oficial", () => {
    const api = readFileSync("src/lib/technicians.functions.ts", "utf8");
    const ui = readFileSync("src/routes/tecnicos.index.tsx", "utf8");
    expect(api).toContain('.contains("coverage_city_ids", [selectedCityId])');
    expect(api).toContain("readPublicEligibleRows(");
    expect(api).toContain('.range((data.pagina - 1) * 50, data.pagina * 50 - 1)');
    expect(ui).toContain("!search.municipio_ibge && canShowLegacyArchive(search)");
    expect(api).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
