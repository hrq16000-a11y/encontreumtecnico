import { describe, expect, it } from "vitest";
import { canShowLegacyArchive } from "./legacy-archive-filters";

describe("truthful historical WordPress search", () => {
  it("allows browsing the unfiltered archive only", () => {
    expect(canShowLegacyArchive({})).toBe(true);
    expect(canShowLegacyArchive({
      especialidade: "Todas", cidade: "", regiao: "",
      servico: "", uf: "", bairro: "",
    })).toBe(true);
    expect(canShowLegacyArchive({ especialidade: " Todas " })).toBe(true);
  });

  it.each([
    ["especialidade", { especialidade: "informatica" }],
    ["servico", { servico: "formatacao-computadores" }],
    ["uf", { uf: "PR" }],
    ["cidade", { cidade: "São José dos Pinhais" }],
    ["bairro", { bairro: "Centro" }],
    ["regiao", { regiao: "Curitiba e região" }],
  ] as const)("does not imply verified coverage by %s", (_label, search) => {
    expect(canShowLegacyArchive(search)).toBe(false);
  });

  it("ignores blank whitespace but suppresses the archive if any filter is set", () => {
    expect(canShowLegacyArchive({
      especialidade: "Todas", cidade: "  ", uf: " ", servico: "\t",
    })).toBe(true);
    expect(canShowLegacyArchive({
      especialidade: "Todas", cidade: "  ", servico: "cftv", uf: "PR",
    })).toBe(false);
  });
});
