// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readPendingFilter, savePendingFilter } from "./pending-search-filter";
import { technicianSearchAfterUfChange } from "./technician-search-uf-transition";

beforeEach(() => sessionStorage.clear());

describe("Troca de UF na busca mobile", () => {
  it("limpa cidade, bairro, região e rascunhos pendentes da UF anterior", () => {
    for (const [id, draft] of [
      ["filtro-cidade", "Curitiba"],
      ["filtro-bairro", "Boqueirão"],
      ["filtro-regiao", "Região Metropolitana"],
    ] as const) {
      expect(savePendingFilter(id, "", draft, sessionStorage)).toBe(true);
      expect(readPendingFilter(id, "", sessionStorage)).toBe(draft);
    }
    sessionStorage.setItem("filtro-nao-relacionado", "preservar");
    expect(technicianSearchAfterUfChange("SP", "regiao", sessionStorage)).toEqual({
      uf: "SP", cidade: "", bairro: "", regiao: "", prioridade: "regiao",
    });
    for (const id of ["filtro-cidade", "filtro-bairro", "filtro-regiao"]) {
      expect(readPendingFilter(id, "", sessionStorage)).toBeNull();
    }
    expect(sessionStorage.getItem("filtro-nao-relacionado")).toBe("preservar");
  });

  it("ao selecionar todos os estados, remove prioridade regional sem localidade", () => {
    expect(technicianSearchAfterUfChange("", "regiao", sessionStorage)).toEqual({
      uf: "", cidade: "", bairro: "", regiao: "", prioridade: "",
    });
  });

  it("não ativa a priorização regional se ela não estava selecionada", () => {
    expect(technicianSearchAfterUfChange("PR", "", sessionStorage)).toEqual({
      uf: "PR", cidade: "", bairro: "", regiao: "", prioridade: "",
    });
  });
});
