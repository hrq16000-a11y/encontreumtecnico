import { describe, expect, it } from "vitest";
import { normalizeTechnicianSearch } from "./technician-search";

describe("normalizeTechnicianSearch", () => {
  it("preserva especialidade e cidade preenchidas", () => {
    expect(normalizeTechnicianSearch({ especialidade: " Computador ", cidade: " Curitiba " })).toEqual({
      especialidade: "Computador",
      cidade: "Curitiba",
    });
  });
  it("rejeita valores não textuais e limita tamanho", () => {
    const result = normalizeTechnicianSearch({ especialidade: {x:1}, cidade: "a".repeat(200) });
    expect(result.especialidade).toBe("");
    expect(result.cidade).toHaveLength(100);
  });
});
