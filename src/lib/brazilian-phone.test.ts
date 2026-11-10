import { describe, expect, it } from "vitest";
import { normalizeBrazilianPhone } from "./brazilian-phone";

describe("telefone brasileiro privado", () => {
  it("aceita DDD + telefone fixo (10 dígitos) em vários formatos", () => {
    for (const input of [
      "4133334444",
      "(41) 3333-4444",
      "55 41 3333-4444",
      "+55 (41) 3333-4444",
      "+554133334444",
    ]) {
      expect(normalizeBrazilianPhone(input)).toBe("+554133334444");
    }
  });

  it("aceita DDD + celular (11 dígitos) em vários formatos", () => {
    for (const input of [
      "41999998888",
      "(41) 99999-8888",
      "55 41 99999-8888",
      "+55 (41) 99999-8888",
      "+5541999998888",
    ]) {
      expect(normalizeBrazilianPhone(input)).toBe("+5541999998888");
    }
  });

  it("não aceita sem DDD, números truncados, letras ou injeção", () => {
    for (const input of [
      "",
      "33334444",
      "999998888",
      "419999888",
      "419999988880",
      "+55 41 99999-888",
      "0011999998888",
      "001199998888",
      "(00) 3333-4444",
      "(01) 99999-8888",
      "(41) 1333-4444",
      "(41) 12345-6789",
      "41 99999-8888 ramal 2",
      "javascript:41999998888",
      "+55+41999998888",
      "41 99999-8888; DROP TABLE contacts",
    ]) {
      expect(normalizeBrazilianPhone(input), input).toBeNull();
    }
  });

  it("rejeita excesso de caracteres antes de normalizar", () => {
    expect(normalizeBrazilianPhone("41" + " ".repeat(45) + "33334444")).toBeNull();
  });
});
