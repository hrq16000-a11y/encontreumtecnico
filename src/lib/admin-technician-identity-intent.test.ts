import { describe, expect, it } from "vitest";
import { shouldWriteTechnicianIdentity, technicianIdentityPayload,
  type TechnicianIdentityDraft } from "./admin-technician-identity-intent";

const empty: TechnicianIdentityDraft = {
  email: "", postal_code: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", uf: "",
};

describe("intenção de escrita cadastral privada", () => {
  it("não regrava identidade intacta ao editar somente a ficha profissional", () => {
    const persisted = technicianIdentityPayload({ ...empty, email: "pessoa@example.com", city: "Curitiba", uf: "PR" });
    const reopened = technicianIdentityPayload({ ...empty, email: " Pessoa@Example.com ", city: " Curitiba ", uf: "pr" });
    expect(shouldWriteTechnicianIdentity(reopened, persisted, true)).toBe(false);
  });

  it("grava quando o administrador realmente altera e-mail ou endereço", () => {
    const persisted = technicianIdentityPayload({ ...empty, city: "Curitiba" });
    const changed = technicianIdentityPayload({ ...empty, city: "Pinhais" });
    expect(shouldWriteTechnicianIdentity(changed, persisted, true)).toBe(true);
  });

  it("cria identidade somente com informação preenchida e preserva baseline ausente", () => {
    const blank = technicianIdentityPayload(empty);
    expect(shouldWriteTechnicianIdentity(blank, null, false)).toBe(false);
    expect(shouldWriteTechnicianIdentity(technicianIdentityPayload({ ...empty, postal_code: "83000-000" }), null, false)).toBe(true);
    expect(shouldWriteTechnicianIdentity(blank, null, true)).toBe(false);
  });
});
