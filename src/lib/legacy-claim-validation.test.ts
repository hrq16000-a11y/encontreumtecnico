import { describe, expect, it } from "vitest";
import { normalizeWpPostId, normalizeClaimantNote, normalizeVerificationNote } from "./legacy-claim-validation";

describe("reivindicação de cadastro histórico", () => {
  it("aceita só IDs WordPress positivos seguros", () => {
    expect(normalizeWpPostId(" 12345 ")).toBe(12345);
    for (const value of ["0", "-1", "1.5", "https://example.com", "001", " ", "1e3", "9999999999999"]) {
      expect(normalizeWpPostId(value)).toBeNull();
    }
  });
  it("limita observações do solicitante", () => {
    expect(normalizeClaimantNote(" Eu sou\n técnico ")).toBe("Eu sou técnico");
    expect(normalizeClaimantNote("x".repeat(600))).toHaveLength(500);
  });
  it("exige justificativa de verificação independente antes de vincular", () => {
    expect(normalizeVerificationNote("confirmado")).toBeNull();
    expect(normalizeVerificationNote("Verificação de titularidade por canal independente.")).not.toBeNull();
    expect(normalizeVerificationNote("x".repeat(601))).toBeNull();
  });
});
