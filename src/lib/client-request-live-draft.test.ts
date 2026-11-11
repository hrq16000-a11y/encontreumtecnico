import { beforeEach, describe, expect, it } from "vitest";
import { readProtectedDraft } from "./protected-session-draft";
import { saveClientRequestDraftImmediately } from "./client-request-live-draft";
import type { ClientRequestDraft } from "./client-request-wizard";

const start: ClientRequestDraft = {
  title: "Problema com a internet",
  description: "O roteador cai frequentemente ao longo do dia.",
  category: "redes", city: "Curitiba", region: "Centro",
};

beforeEach(() => sessionStorage.clear());

describe("gravação imediata do pedido privado", () => {
  it("salva o último caractere e a etapa sem depender do efeito do React", () => {
    const next = { ...start, description: start.description + "!" };
    expect(saveClientRequestDraftImmediately("cliente-a", true, next, 2, sessionStorage)).toBe(true);
    expect(readProtectedDraft<ClientRequestDraft>("cliente", "cliente-a", sessionStorage))
      .toEqual({ form: next, step: 2 });
  });

  it("não grava dados de visitantes ou usuários sem papel de cliente confirmado", () => {
    expect(saveClientRequestDraftImmediately(null, true, start, 1, sessionStorage)).toBe(false);
    expect(saveClientRequestDraftImmediately("cliente-a", false, start, 1, sessionStorage)).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it("isola dados de cada titular sem colocar autorização de envio no rascunho", () => {
    saveClientRequestDraftImmediately("cliente-a", true, start, 4, sessionStorage);
    saveClientRequestDraftImmediately("cliente-b", true, { ...start, title: "Outro problema" }, 1, sessionStorage);
    expect(readProtectedDraft<ClientRequestDraft>("cliente", "cliente-a", sessionStorage)?.form.title)
      .toBe("Problema com a internet");
    expect(readProtectedDraft<ClientRequestDraft>("cliente", "cliente-b", sessionStorage)?.form.title)
      .toBe("Outro problema");
    const stored = sessionStorage.getItem("eut-unsent-v1:cliente:cliente-a") ?? "";
    expect(stored).not.toMatch(/shareNow|consent|technicianTarget|access_token|password/i);
  });

  it("recusa rascunhos grandes e não armazena texto em localStorage", () => {
    expect(saveClientRequestDraftImmediately(
      "cliente-a", true, { ...start, description: "x".repeat(12000) }, 1, sessionStorage,
    )).toBe(false);
    expect(localStorage.getItem("eut-unsent-v1:cliente:cliente-a")).toBeNull();
  });
});
