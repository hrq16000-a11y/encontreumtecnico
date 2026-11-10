import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeTriageDraft, saveTriageDraft } from "./triage-draft";

describe("rascunho privado da triagem", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it("transporta categoria, descrição e cidade uma só vez", () => {
    expect(saveTriageDraft({
      description: "Meu notebook não liga, preciso de ajuda",
      category: "Computador",
      city: "Curitiba",
      region: "Boqueirão",
    })).toBe(true);
    const draft = consumeTriageDraft();
    expect(draft).toMatchObject({
      description: "Meu notebook não liga, preciso de ajuda",
      category: "computadores",
      city: "Curitiba",
      region: "Boqueirão",
    });
    expect(consumeTriageDraft()).toBeNull();
  });

  it("recusa descrição insuficiente", () => {
    expect(saveTriageDraft({ description: "oi", category: "Todas", city: "", region: "" })).toBe(false);
    expect(consumeTriageDraft()).toBeNull();
  });

  it("expira após 30 minutos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T20:00:00Z"));
    saveTriageDraft({ description: "Impressora não imprime nem copia", category: "impressoras", city: "", region: "" });
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(consumeTriageDraft()).toBeNull();
    vi.useRealTimers();
  });
});
