import { beforeEach, describe, expect, it } from "vitest";
import { readProtectedDraft } from "./protected-session-draft";
import { saveTechnicianDraftImmediately } from "./technician-live-draft";

const form = {
  display_name: "Técnico de notebooks", state_uf: "PR", city: "Curitiba",
  neighborhood: "", region: "", bio: "Faço manutenção de notebooks e redes.",
  specialties: ["computadores"], service_slugs: ["manutencao-notebooks"],
  base_city_ibge_id: 4106902,
};
beforeEach(() => sessionStorage.clear());
describe("rascunho de técnico salva sem aguardar renderização", () => {
  it("preserva a última edição e etapa antes de navegar ou alternar aba", () => {
    const updated = { ...form, bio: form.bio + " Trabalho com Windows 11." };
    expect(saveTechnicianDraftImmediately("tech-a", true, updated, 3, sessionStorage)).toBe(true);
    expect(readProtectedDraft<typeof form>("tecnico", "tech-a", sessionStorage))
      .toEqual({ form: updated, step: 3 });
  });
  it("recusa visitantes e perfis não verificados, sem cruzar contas", () => {
    expect(saveTechnicianDraftImmediately(null, true, form, 2, sessionStorage)).toBe(false);
    expect(saveTechnicianDraftImmediately("tech-a", false, form, 2, sessionStorage)).toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(saveTechnicianDraftImmediately("tech-a", true, form, 2, sessionStorage)).toBe(true);
    expect(readProtectedDraft("tecnico", "tech-b", sessionStorage)).toBeNull();
    expect(readProtectedDraft("cliente", "tech-a", sessionStorage)).toBeNull();
  });
  it("não grava chaves de acesso ou autorizações de contato", () => {
    saveTechnicianDraftImmediately("tech-a", true, form, 1, sessionStorage);
    expect(sessionStorage.getItem("eut-unsent-v1:tecnico:tech-a"))
      .not.toMatch(/access_token|password|consent|payment|contact_unlock/i);
    expect(localStorage.getItem("eut-unsent-v1:tecnico:tech-a")).toBeNull();
  });
});
