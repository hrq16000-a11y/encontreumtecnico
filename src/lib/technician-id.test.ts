import { describe, expect, it } from "vitest";
import { isValidTechnicianId } from "./technician-id";

describe("IDs da página pública do técnico", () => {
  it("aceita um UUID com grupos hexadecimais corretos", () => {
    expect(isValidTechnicianId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidTechnicianId("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });
  it.each([
    "", "123", "------------------------------------",
    "000000000000000000000000000000000000",
    "550e8400-e29b-41d4-a716-44665544000g",
    "550e8400-e29b-41d4-a716-446655440000/contato",
    " 550e8400-e29b-41d4-a716-446655440000",
    "../../admin",
  ])("rejeita parâmetros inválidos sem consultar banco: %s", (id) => {
    expect(isValidTechnicianId(id)).toBe(false);
  });
});
