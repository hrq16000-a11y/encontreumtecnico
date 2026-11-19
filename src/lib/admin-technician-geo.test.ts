import { describe, expect, it } from "vitest";
import { dddFromBrazilPhone, verifiedBaseCity } from "./admin-technician-geo";

const municipalities = [
  { id: 4106902, name: "Curitiba", uf: "PR" },
  { id: 4125506, name: "São José dos Pinhais", uf: "PR" },
  { id: 3550308, name: "São Paulo", uf: "SP" },
];

describe("prévia administrativa de localização e DDD", () => {
  it("resolve apenas a correspondência municipal oficial única", () => {
    expect(verifiedBaseCity(" curitiba ", "PR", municipalities)?.id).toBe(4106902);
    expect(verifiedBaseCity("Curitiba", "SP", municipalities)).toBeNull();
    expect(verifiedBaseCity("Brasil", "PR", municipalities)).toBeNull();
    expect(verifiedBaseCity("Curitiba", "PR", [...municipalities, municipalities[0]!])).toBeNull();
  });

  it("extrai DDD válido sem atribuir município", () => {
    expect(dddFromBrazilPhone("(41) 99999-9999")).toBe("41");
    expect(dddFromBrazilPhone("+55 11 98888-7777")).toBe("11");
    expect(dddFromBrazilPhone("sem telefone")).toBeNull();
    expect(dddFromBrazilPhone("41")).toBeNull();
  });
});
