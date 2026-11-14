import { describe, expect, it } from "vitest";
import { validAdminContactReason } from "./admin-technician-contact-access";

describe("consulta auditada de contato do técnico", () => {
  it("requer justificativa real antes de permitir revelar", () => {
    expect(validAdminContactReason(" ")).toBe(false);
    expect(validAdminContactReason("curto")).toBe(false);
    expect(validAdminContactReason("Conferir ficha")).toBe(true);
    expect(validAdminContactReason("x".repeat(501))).toBe(false);
  });
});
