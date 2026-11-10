import { describe, expect, it } from "vitest";
import { normalizeBrazilianContact } from "./brazilian-contact";

describe("Telefone de técnico brasileiro com 10 ou 11 dígitos", () => {
  it.each([
    ["(41) 3333-1234", "+554133331234"],
    ["4133331234", "+554133331234"],
    ["(41) 99999-1234", "+5541999991234"],
    ["41999991234", "+5541999991234"],
    ["+55 (41) 99999-1234", "+5541999991234"],
    ["55 41 3333-1234", "+554133331234"],
    ["+55 (41) 3333-1234", "+554133331234"],
    ["55 (41) 99999-1234", "+5541999991234"],
  ])("aceita %s e normaliza com +55", (input, expected) => {
    expect(normalizeBrazilianContact(input)).toBe(expected);
  });

  it.each([
    "",
    "123456",
    "413331234",
    "419999912345",
    "0011999991234",
    "+44 20 7788 1234",
    "41 abc 99999 1234",
    "0000000000",
    "4111111111",
    "123 456789",
  ])("recusa entrada inválida %s", (input) => {
    expect(normalizeBrazilianContact(input)).toBeNull();
  });

  it("não remove o DDD 55 de um número nacional de 10 dígitos", () => {
    expect(normalizeBrazilianContact("55 3333-1234")).toBe("+555533331234");
  });
});
