import { beforeEach, describe, expect, it } from "vitest";
import { guideDraftScope, portalHelpContext } from "./free-search-help";
import { clearAssistanceDraft, readAssistanceDraft, saveAssistanceDraft, type AssistanceDraft } from "./assistance-draft";

beforeEach(() => window.sessionStorage.clear());

const draft: AssistanceDraft = {
  mode: "managed", step: 2, name: "Cliente", email: "cliente@example.com",
  service: "Wi-Fi", when: "Amanhã", problem: "Sem conexão no notebook",
  city: "Curitiba", uf: "PR", neighborhood: "Centro",
};

describe("unsent assistance wizard survives navigation and mobile reload", () => {
  it("keeps incomplete text and step only in the same tab", () => {
    expect(saveAssistanceDraft(undefined, draft, sessionStorage, 100000)).toBe(true);
    expect(readAssistanceDraft(undefined, sessionStorage, 100000)).toEqual(draft);
  });
  it("does not mix contexts of two different technician profiles", () => {
    const id = "b190db33-86e1-4cf4-b916-a1f4eac56720";
    saveAssistanceDraft(id, { ...draft, mode: "direct" }, sessionStorage);
    expect(readAssistanceDraft(undefined, sessionStorage)).toBeNull();
    expect(readAssistanceDraft(id, sessionStorage)?.mode).toBe("direct");
    clearAssistanceDraft(id, sessionStorage);
    expect(readAssistanceDraft(id, sessionStorage)).toBeNull();
  });
  it("isolates help intents without exposing customer text in the storage key", () => {
    const generic = portalHelpContext("contato");
    const privacy = portalHelpContext("contato", "privacidade");
    const home = portalHelpContext("home");
    saveAssistanceDraft(generic.draftScope, draft, sessionStorage);
    expect(readAssistanceDraft(privacy.draftScope, sessionStorage)).toBeNull();
    expect(readAssistanceDraft(home.draftScope, sessionStorage)).toBeNull();
    expect(readAssistanceDraft(undefined, sessionStorage)).toBeNull();
    saveAssistanceDraft(privacy.draftScope, { ...draft, problem: "Quero corrigir meus dados." }, sessionStorage);
    expect(readAssistanceDraft(generic.draftScope, sessionStorage)?.problem).toBe(draft.problem);
    expect(readAssistanceDraft(privacy.draftScope, sessionStorage)?.problem).toBe("Quero corrigir meus dados.");
    clearAssistanceDraft(privacy.draftScope, sessionStorage);
    expect(readAssistanceDraft(privacy.draftScope, sessionStorage)).toBeNull();
    expect(readAssistanceDraft(generic.draftScope, sessionStorage)).toEqual(draft);
  });
  it("keeps service-category drafts apart and shares the same category across guides", () => {
    const cftv = guideDraftScope("cftv");
    const redes = guideDraftScope("redes");
    expect(cftv).toBe("service-cftv");
    expect(redes).toBe("service-redes");
    expect(guideDraftScope("unknown")).toBeUndefined();
    expect(guideDraftScope("cftv@example.com")).toBeUndefined();
    saveAssistanceDraft(cftv, draft, sessionStorage);
    expect(readAssistanceDraft(redes, sessionStorage)).toBeNull();
    expect(readAssistanceDraft(undefined, sessionStorage)).toBeNull();
    expect(readAssistanceDraft(guideDraftScope("cftv"), sessionStorage)).toEqual(draft);
    clearAssistanceDraft(guideDraftScope("cftv"), sessionStorage);
    expect(readAssistanceDraft(cftv, sessionStorage)).toBeNull();
  });
  it("expires and never persists payment credentials or explicit consent", () => {
    saveAssistanceDraft(undefined, draft, sessionStorage, 100000);
    const raw = sessionStorage.getItem("eut-assistance-unsent-v1:general") ?? "";
    expect(raw).not.toMatch(/password|token|card_number|consent/i);
    expect(readAssistanceDraft(undefined, sessionStorage, 100000 + 46 * 60 * 1000)).toBeNull();
  });
});
