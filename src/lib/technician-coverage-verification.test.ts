import { describe, expect, it } from "vitest";
import { technicianCoverageWasPersisted } from "./technician-coverage-verification";

describe("releitura da cobertura técnica no servidor", () => {
  it("aceita as mesmas cidades IBGE em ordem diferente e raio confirmado", () => {
    expect(technicianCoverageWasPersisted([4106902, 4125506], 50, {
      coverage_city_ids: [4125506, 4106902], service_radius_km: 50,
    })).toBe(true);
  });
  it("não aceita uma gravação ausente, parcial ou divergente", () => {
    expect(technicianCoverageWasPersisted([4106902], null, null)).toBe(false);
    expect(technicianCoverageWasPersisted([4106902], 20, {
      coverage_city_ids: [4106902], service_radius_km: null,
    })).toBe(false);
    expect(technicianCoverageWasPersisted([4106902, 4125506], 20, {
      coverage_city_ids: [4106902], service_radius_km: 20,
    })).toBe(false);
    expect(technicianCoverageWasPersisted([4106902], null, {
      coverage_city_ids: [4106902, 4106902], service_radius_km: null,
    })).toBe(false);
  });
});
