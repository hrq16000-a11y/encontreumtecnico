import { describe, expect, it } from "vitest";
import { confirmedAdminTechnicianAction as confirms } from "./admin-technician-action-confirmation";

const id = "8c99190d-989a-4b11-8018-ea55e333bd39";

describe("confirmação da ação administrativa de técnico", () => {
  it.each([
    ["aprovar", "pendente", "aprovado"],
    ["suspender", "aprovado", "suspenso"],
    ["reativar", "suspenso", "aprovado"],
    ["rejeitar", "pendente", "rejeitado"],
    ["revisar", "rejeitado", "pendente"],
  ] as const)("confirma %s apenas com estado %s → %s", (action, before, after) => {
    expect(confirms({ id, name: "Técnico de teste", status: after }, id, action, before, "Técnico de teste"))
      .toBe(true);
    expect(confirms({ id, name: "Técnico de teste", status: before }, id, action, before, "Técnico de teste"))
      .toBe(false);
  });

  it("rejeita ID sem estado, nome ausente ou ID diferente", () => {
    expect(confirms({ id }, id, "suspender", "aprovado", "Técnico de teste")).toBe(false);
    expect(confirms({ id, status: "suspenso" }, id, "suspender", "aprovado", "Técnico de teste")).toBe(false);
    expect(confirms({ id: "outro", name: "Teste", status: "suspenso" }, id, "suspender", "aprovado", "Teste")).toBe(false);
  });

  it("exige o nome editado e preservação de status na edição", () => {
    const result = { id, name: "Nome corrigido", status: "aprovado" };
    expect(confirms(result, id, "editar", "aprovado", " Nome corrigido ")).toBe(true);
    expect(confirms(result, id, "editar", "aprovado", "Nome anterior")).toBe(false);
    expect(confirms(result, id, "editar", "suspenso", "Nome corrigido")).toBe(false);
  });
});
