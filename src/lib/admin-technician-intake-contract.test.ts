import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql", "utf8");
const assertions = readFileSync("docs/sql/tests/eut-admin-crud-ephemeral-assertions-20261111.sql", "utf8");
const manager = readFileSync("src/components/admin-technician-record-editor.tsx", "utf8");
const directory = readFileSync("src/components/admin-technician-unified-directory.tsx", "utf8");
const editor = readFileSync("src/components/admin-technician-manager.tsx", "utf8");
const advanced = readFileSync("src/components/admin-technician-comprehensive-draft.tsx", "utf8");

describe("CRUD administrativo de técnicos com contato privado", () => {
  it("envia edição avançada somente pela RPC auditada e reconhece ausência da função", () => {
    expect(editor).toContain('db.rpc("eut_admin_technician_change"');
    expect(editor).toContain("adminTechnicianChangePayload");
    expect(editor).toContain("data?.technician_id");
    expect(editor).not.toContain("localStorage");
  });
  it("cria e edita fichas manuais sem criar usuários fictícios ou divulgar contato", () => {
    expect(manager).toContain('db.rpc("eut_admin_technician_record_save"');
    expect(directory).toContain('db.rpc("eut_admin_technician_registry_list"');
    expect(manager).toContain('db.rpc("eut_admin_technician_record_archive"');
    expect(manager).toContain("normalizeBrazilPhoneE164(phone)");
    expect(manager).not.toContain("auth.admin.createUser");
    expect(manager).not.toContain("localStorage");
    expect(sql).toContain("portal_technician_id uuid UNIQUE REFERENCES public.technicians(id)");
    expect(sql).toContain("contact_suspended boolean NOT NULL DEFAULT false");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });
  it("arquiva e restaura cadastros operacionais somente por RPC auditada", () => {
    expect(advanced).toContain('adminDb.rpc("eut_admin_technician_archive"');
    expect(advanced).toContain("prepareReversibleArchive");
    expect(advanced).toContain("data?.contact_enabled !== false");
    expect(advanced).toContain("data?.archived !== !isArchived");
    expect(editor).toContain("onArchived={(message)");
    expect(advanced).not.toContain(".delete(");
  });
  it("homologa duplicidade, banimento, versão, privacidade, arquivo e permissões", () => {
    for (const message of [
      "Import retry overwrote existing record",
      "Banned phone accepted",
      "Stale registry version accepted",
      "Suspended contact bypassed",
      "Client listed admin registry",
      "Audit failure failed to roll back registry and contact",
    ]) expect(assertions).toContain(message);
  });
});
