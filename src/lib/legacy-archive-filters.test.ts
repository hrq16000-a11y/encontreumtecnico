import { describe, expect, it } from "vitest";
import { canShowLegacyArchive } from "./legacy-archive-filters";
describe("read-only historic listing", () => {
  it("shows WordPress archive for an unfiltered browse", () => {
    expect(canShowLegacyArchive({ especialidade: "Todas", cidade: "", regiao: "" })).toBe(true);
  });
  it("never treats old national/unknown records as city or specialty matches", () => {
    expect(canShowLegacyArchive({ especialidade: "Computador", cidade: "", regiao: "" })).toBe(false);
    expect(canShowLegacyArchive({ especialidade: "Todas", cidade: "Curitiba", regiao: "" })).toBe(false);
    expect(canShowLegacyArchive({ especialidade: "Todas", cidade: "", regiao: "Centro" })).toBe(false);
    expect(canShowLegacyArchive({ especialidade: "Todas", uf: "PR" })).toBe(false);
    expect(canShowLegacyArchive({ especialidade: "Todas", bairro: "Centro" })).toBe(false);
    expect(canShowLegacyArchive({ especialidade: "cat:computadores" })).toBe(false);
    expect(canShowLegacyArchive({ especialidade: "svc:manutencao-notebook" })).toBe(false);
  });
});
