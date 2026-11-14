import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql", "utf8");
const assertions = readFileSync("docs/sql/tests/eut-admin-crud-ephemeral-assertions-20261111.sql", "utf8");
const manager = readFileSync("src/components/admin-technician-intake-manager.tsx", "utf8");
const editor = readFileSync("src/components/admin-technician-comprehensive-draft.tsx", "utf8");

describe("CRUD administrativo de técnicos com contato privado", () => {
  it("envia edição avançada somente pela RPC auditada e reconhece ausência da função", () => {
    expect(editor).toContain('db.rpc("eut_admin_technician_change"');
    expect(editor).toContain("buildProposedTechnicianChangeArgs");
    expect(editor).toContain("data.technician_id !== technician.id");
    expect(editor).toContain("PGRST202");
    expect(editor).not.toContain("localStorage");
  });
  it("cria e edita fichas manuais sem criar usuários fictícios ou divulgar contato", () => {
    expect(manager).toContain('db.rpc("eut_admin_technician_intake_save"');
    expect(manager).toContain('db.rpc("eut_admin_technician_intake_list"');
    expect(manager).toContain("normalizeBrazilPhoneE164(phone)");
    expect(manager).not.toContain("auth.admin.createUser");
    expect(manager).not.toContain("localStorage");
    expect(sql).toContain("linked_technician_id uuid REFERENCES public.technicians(id)");
    expect(sql).toContain("contact_public',false");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });
  it("homologa duplicidade, banimento, versão, privacidade, arquivo e permissões", () => {
    for (const message of [
      "Intake duplicated an existing technician contact",
      "Intake accepted a blocked phone",
      "Intake stale version accepted",
      "Intake archive lost contact, omitted audit or leaked phone",
      "Client can enumerate manual intake",
      "Client can create manual intake",
      "Name-only edit fabricated locality or unblocked contact",
    ]) expect(assertions).toContain(message);
  });
});
