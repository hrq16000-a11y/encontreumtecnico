import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("cadastro administrativo sem conta artificial", () => {
  it("envia apenas a função restrita e confirma a resposta do banco", () => {
    const editor = read("src/components/admin-technician-record-editor.tsx");
    expect(editor).toContain('db.rpc("eut_admin_technician_record_save"');
    expect(editor).toContain("_expected_updated_at: existing?.updated_at ?? null");
    expect(editor).toContain("if (data?.ok !== true");
    expect(editor).toContain("disabled={!available || busy || !acknowledged || Boolean(existing?.archived) || importedDemo}");
    expect(editor).toContain('db.rpc("eut_admin_technician_record_archive"');
    expect(editor).toContain('code === "PGRST202"');
    expect(editor).not.toMatch(/auth\.admin|service_role|createUser\(/);
  });

  it("não permite supor que fichas migradas são contas de login", () => {
    const sql = read("docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS eut_moderation.admin_technician_records");
    expect(sql).toContain("UNIQUE(origin,source_id)");
    expect(sql).toContain("IF _expected_updated_at IS NULL AND _origin<>'manual' AND v_active THEN");
    expect(sql).toContain("IF v_phone_action<>'keep' AND coalesce(v_old_suspended,false) THEN");
    expect(sql).toContain("SECURITY DEFINER SET search_path='pg_catalog'");
    expect(sql).toContain("REVOKE ALL ON TABLE eut_moderation.admin_technician_records");
  });

  it("mantém uma única gestão e não expõe contato integral na listagem", () => {
    const directory = read("src/components/admin-technician-unified-directory.tsx");
    const editor = read("src/components/admin-technician-record-editor.tsx");
    const sql = read("docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql");
    expect(directory).toContain("AdminTechnicianRecordEditor");
    expect(directory).toContain("eut_admin_technician_registry_list");
    expect(directory).toContain('createOrigin="wordpress"');
    expect(directory).toContain('createOrigin="guiafix"');
    expect(directory).toContain('guiafixAdminSourceId(row.key)');
    expect(directory).toContain('Editar técnico');
    expect(directory).toContain('unifiedPageSlice(');
    expect(directory).toContain("wordpress_20261108:${row.wpPostId}");
    expect(directory).toContain("Preparar importação CSV");
    expect(directory).toContain('eq("kind", "candidate")');
    expect(directory).not.toContain("<AdminTechnicianIntakeManager />");
    expect(sql).toContain("contact_last4 text");
    expect(directory).not.toMatch(/eut_technician_private_contacts|auth\.admin/);
    expect(directory).not.toContain("error.message");
    expect(directory).not.toMatch(/Rastreabilidade|Origem:|Vínculo operacional não comprovado|Ficha de referência sem vínculo/);
    expect(editor).not.toContain("readOnly={importedCreation}");
    expect(editor).toContain('createOrigin?: "manual" | "wordpress" | "guiafix"');
  });
});
