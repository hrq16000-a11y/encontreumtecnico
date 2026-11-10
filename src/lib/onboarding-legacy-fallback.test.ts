import { describe, expect, it } from "vitest";
import { canAttemptNewAccountRole } from "./onboarding-legacy-fallback";

describe("Cadastro novo independente do lookup histórico", () => {
  it("permite tentar um novo cadastro quando não há vínculo WordPress", () => {
    expect(canAttemptNewAccountRole({
      legacyChecked: true, legacyLookupError: false, legacyRole: null,
    })).toBe(true);
  });

  it("não bloqueia usuário novo só porque a consulta opcional falhou", () => {
    expect(canAttemptNewAccountRole({
      legacyChecked: false, legacyLookupError: true, legacyRole: null,
    })).toBe(true);
  });

  it("não oferece outro papel para conta antiga de tipo já conhecido", () => {
    for (const legacyRole of ["tecnico", "cliente"] as const) {
      expect(canAttemptNewAccountRole({
        legacyChecked: true, legacyLookupError: false, legacyRole,
      })).toBe(false);
    }
  });

  it("não libera escolha enquanto o lookup ainda está em andamento", () => {
    expect(canAttemptNewAccountRole({
      legacyChecked: false, legacyLookupError: false, legacyRole: null,
    })).toBe(false);
  });

  it("não gera escolha para papel legado mesmo sob falha ambígua", () => {
    expect(canAttemptNewAccountRole({
      legacyChecked: false, legacyLookupError: true, legacyRole: "tecnico",
    })).toBe(false);
  });
});
