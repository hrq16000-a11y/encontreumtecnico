import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

describe("gestão interna de e-mail e endereço", () => {
  it("centraliza visualização e edição na ficha 360 sem alterar o telefone existente", () => {
    const sheet = read("src/components/admin-technician-360-sheet.tsx");
    const contact = read("src/components/admin-technician-contact-access.tsx");
    const editor = read("src/components/admin-technician-identity-editor.tsx");
    expect(sheet).toContain("<AdminTechnicianContactAccess recordKey={record.key} />");
    expect(sheet).toContain("<AdminTechnicianIdentityEditor recordKey={record.key} />");
    expect(contact).toContain('db.rpc("eut_admin_unified_contact"');
    expect(editor).toContain('db.rpc("eut_admin_identity_get"');
    expect(editor).toContain('db.rpc("eut_admin_identity_save"');
    expect(editor).toContain("_expected_updated_at: revision");
    expect(editor).toContain("data.updated_at");
    expect(editor).not.toContain("service_role");
  });

  it("restringe APIs e armazenamento a administração, sem expor e-mail/endereço publicamente", () => {
    const sql = read("docs/sql/eut-admin-identity-address-20261118.sql");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON eut_moderation.admin_technician_identity FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("public.has_role(v_actor,'admin'::public.app_role)");
    expect(sql).toContain("u.email_confirmed_at IS NOT NULL");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_admin_identity_get(text)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_admin_identity_get(text) TO authenticated");
    expect(sql).toContain("INSERT INTO public.eut_admin_management_log");
    expect(sql).not.toContain("UPDATE auth.users");
    expect(sql).not.toContain("UPDATE eut_moderation.admin_technician_record_contacts");
  });
});