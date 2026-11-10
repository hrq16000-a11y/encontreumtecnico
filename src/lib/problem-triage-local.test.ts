import { describe, expect, it } from "vitest";
import { categorySlug, extractDeclaredLocation, triageLocally } from "./problem-triage-local";

describe("triagem local sem gateway pago", () => {
  it.each([
    ["Meu notebook não liga e não sei o que fazer", "computadores"],
    ["Preciso formatar Windows no computador", "software"],
    ["O roteador wifi não conecta na internet", "redes"],
    ["Minha impressora de cartucho parou", "impressoras"],
    ["Instalação de câmera de segurança e DVR", "cftv"],
    ["Meu ar condicionado split parou", "climatizacao"],
    ["Trocar tomada e disjuntor", "eletrica"],
  ])("classifica %s", (phrase, category) => {
    expect(triageLocally(phrase).category).toBe(category);
  });

  it("retorna todas quando não há correspondência ao invés de inventar especialidade", () => {
    const result = triageLocally("Preciso de um profissional para serviço não especificado");
    expect(result.category).toBe("Todas");
    expect(result.keywords).toEqual([]);
  });

  it("extrai apenas localização explicitamente declarada", () => {
    expect(extractDeclaredLocation("Moro em Curitiba, no bairro Boqueirão, meu notebook não liga"))
      .toEqual({ city: "Curitiba", region: "Boqueirão" });
    expect(extractDeclaredLocation("Meu notebook não liga")).toEqual({ city: "", region: "" });
  });

  it("normaliza rótulos antigos para os slugs ativos", () => {
    expect(categorySlug("Computador")).toBe("computadores");
    expect(categorySlug("Ar-condicionado")).toBe("climatizacao");
    expect(categorySlug("CFTV")).toBe("cftv");
    expect(categorySlug("qualquer-coisa")).toBeNull();
  });
});
