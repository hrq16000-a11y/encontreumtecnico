import { describe, expect, it } from "vitest";
import { technicianPublicationWasPersisted, type TechnicianPublicationFields, type PublishedTechnicianSnapshot } from "./technician-publication-verification";

const requested: TechnicianPublicationFields = {
  display_name: "Ana Técnica", state_uf: "PR", city: "Curitiba", neighborhood: "Hauer",
  region: "Boqueirão", bio: "Manutenção de computadores", specialties: ["computadores"],
  service_slugs: ["formatacao", "limpeza"],
};
const saved: PublishedTechnicianSnapshot = {
  ...requested, id: "profile-1", status: "aprovado",
};

describe("confirmação real de publicação do técnico", () => {
  it("confirma gravação fiel mesmo quando a ordem dos serviços muda", () => {
    expect(technicianPublicationWasPersisted(requested, { ...saved, service_slugs: ["limpeza", "formatacao"] }, "profile-1")).toBe(true);
  });
  it("não confunde resposta positiva da RPC com persistência de dados incompletos", () => {
    expect(technicianPublicationWasPersisted(requested, { ...saved, bio: null })).toBe(false);
    expect(technicianPublicationWasPersisted(requested, { ...saved, service_slugs: ["formatacao"] })).toBe(false);
    expect(technicianPublicationWasPersisted(requested, { ...saved, city: "São Paulo" })).toBe(false);
    expect(technicianPublicationWasPersisted(requested, { ...saved, status: "suspenso" })).toBe(false);
    expect(technicianPublicationWasPersisted(requested, saved, "another-profile")).toBe(false);
    expect(technicianPublicationWasPersisted(requested, null)).toBe(false);
  });
  it("aceita campos opcionais vazios persistidos como null", () => {
    expect(technicianPublicationWasPersisted({ ...requested, bio: "", neighborhood: "" }, { ...saved, bio: null, neighborhood: null })).toBe(true);
  });
});
