import { beforeEach, describe, expect, it } from "vitest";
import { clearProtectedDraft, readProtectedDraft, saveProtectedDraft } from "./protected-session-draft";

beforeEach(() => sessionStorage.clear());

describe("Rascunhos privados na sessão", () => {
  it("restaura a etapa para a mesma conta e não mistura papéis", () => {
    const form = { title: "Computador não inicia", description: "Computador liga sem vídeo" };
    expect(saveProtectedDraft("cliente", "account-a", form, 3, sessionStorage, 100000)).toBe(true);
    expect(readProtectedDraft<typeof form>("cliente", "account-a", sessionStorage, 100000))
      .toEqual({ form, step: 3 });
    expect(readProtectedDraft("cliente", "account-b", sessionStorage, 100000)).toBeNull();
    expect(readProtectedDraft("tecnico", "account-a", sessionStorage, 100000)).toBeNull();
  });
  it("limita tempo e tamanho do rascunho", () => {
    saveProtectedDraft("cliente", "account-a", { title: "Um teste" }, 1, sessionStorage, 100000);
    expect(readProtectedDraft("cliente", "account-a", sessionStorage, 100000 + 46 * 60 * 1000)).toBeNull();
    expect(saveProtectedDraft("cliente", "bad/owner", {}, 1, sessionStorage)).toBe(false);
    expect(saveProtectedDraft("cliente", "account-a", { text: "a".repeat(15000) }, 1, sessionStorage)).toBe(false);
  });
  it("apaga somente o rascunho do proprietário", () => {
    saveProtectedDraft("cliente", "account-a", { text: "A" }, 1, sessionStorage);
    saveProtectedDraft("cliente", "account-b", { text: "B" }, 1, sessionStorage);
    clearProtectedDraft("cliente", "account-a", sessionStorage);
    expect(readProtectedDraft("cliente", "account-a", sessionStorage)).toBeNull();
    expect(readProtectedDraft("cliente", "account-b", sessionStorage)).not.toBeNull();
  });
});
