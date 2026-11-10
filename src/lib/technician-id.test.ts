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

import { isValidTechnicianSlug } from "./technician-id";

describe("slugs legíveis em vez de UUIDs na URL pública", () => {
  it("aceita nomes, cidades e UF normalizados", () => {
    expect(isValidTechnicianSlug("jefferson-santana-tubarao-sc")).toBe(true);
    expect(isValidTechnicianSlug("tecnico-curitiba-pr-abcdef123456")).toBe(true);
  });
  it.each(["", "ab", "Jefferson-Santana", "São José", "cidade_", "a/contato", "../../admin", "slug--duplo", "slug-", "a".repeat(97)])("rejeita slug inválido: %s", value => {
    expect(isValidTechnicianSlug(value)).toBe(false);
  });
});
