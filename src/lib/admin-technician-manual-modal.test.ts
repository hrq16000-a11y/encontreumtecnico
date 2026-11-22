import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicTextProblem } from "./public-profile-text";

const read = (path: string) => readFileSync(path, "utf8");

describe("cadastro manual: modal e persistencia protegida", () => {
  it("aceita nome de homologacao com data real sem liberar sequencias de telefone", () => {
    expect(publicTextProblem("EUT QA Cadastro Sintetico 20261122", "identity")).toBeNull();
    expect(publicTextProblem("Assistencia 20260230", "identity")).not.toBeNull();
    expect(publicTextProblem("Assistencia 20261122", "identity")).not.toBeNull();
    expect(publicTextProblem("Contato 41999999999", "identity")).not.toBeNull();
    expect(publicTextProblem("Empresa 12345678", "identity")).not.toBeNull();
    expect(publicTextProblem("Empresa whats app", "identity")).not.toBeNull();
  });

  it("abre o formulario em dialog acessivel, sem renderizar cadastro embutido na lista", () => {
    const directory = read("src/components/admin-technician-unified-directory.tsx");
    expect(directory).toContain('aria-haspopup="dialog"');
    expect(directory).toContain('<Dialog open={Boolean(manualSourceId)}');
    expect(directory).toContain("<DialogContent");
    expect(directory).toContain("<DialogTitle>Novo técnico</DialogTitle>");
    expect(directory).toContain("available={registryAvailable} inDialog");
    expect(directory).toContain("onSaved={(message) => { refreshAfterSaved(); setFeedback(message); }}");
  });

  it("mantem apenas nome obrigatorio, sem justificativa nem aceite redundante", () => {
    const editor = read("src/components/admin-technician-record-editor.tsx");
    expect(editor).toContain("Nome <span");
    expect(editor).toContain("required minLength={3}");
    expect(editor).toContain("Telefone <span");
    expect(editor).toContain("Cidade <span");
    expect(editor).toContain("<details");
    expect(editor).not.toContain("Justificativa de auditoria");
    expect(editor).not.toContain("Confirmo que posso cadastrar");
    expect(editor).not.toContain("acknowledged");
    expect(editor).toContain('const auditReason = existing ?');
    expect(editor).toContain("_reason: auditReason");
    expect(editor).toContain('db.rpc("eut_admin_technician_record_save"');
    expect(editor).toContain('db.rpc("eut_admin_technician_registry_list"');
    expect(editor).toContain('db.rpc("eut_admin_technician_record_archive"');
    expect(editor).toContain("existing?.admin_active ?? (createOrigin ===");
    expect(editor).toContain("citySearch.trim() && cityId === null");
    expect(editor).not.toContain("auth.admin.createUser");
  });
});
