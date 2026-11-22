import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const sql = read("docs/sql/eut-admin-imported-clients-directory-20261122.sql");
const ui = read("src/components/admin-imported-clients.tsx");
const page = read("src/routes/admin.tsx");
const contact = read("src/components/admin-technician-contact-access.tsx");

describe("Cadastro unificado: clientes importados no painel administrativo", () => {
  it("restringe ao administrador com conta operacional e e-mail confirmado", () => {
    for (const guard of [
      "SECURITY DEFINER",
      "SET search_path = 'pg_catalog'",
      "v_actor uuid := auth.uid()",
      "public.has_role(v_actor, 'admin'::public.app_role)",
      "public.eut_account_operational()",
      "u.email_confirmed_at IS NOT NULL",
      "REVOKE ALL ON FUNCTION public.eut_admin_imported_clients",
      "FROM PUBLIC, anon, authenticated",
      "GRANT EXECUTE ON FUNCTION public.eut_admin_imported_clients",
      "TO authenticated",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/ALTER TABLE|CREATE POLICY|DISABLE ROW LEVEL SECURITY/i);
    expect(sql).not.toMatch(/INSERT INTO eut_moderation\.imported_user_registry|UPDATE eut_moderation\.imported_user_registry|DELETE FROM eut_moderation\.imported_user_registry/i);
  });

  it("retorna somente clientes paginados sem modificar papéis, suspensões ou contas", () => {
    expect(sql).toContain("WHERE r.role = 'cliente'");
    expect(sql).toContain("LIMIT 20 OFFSET v_page * 20");
    expect(sql).toContain("least(coalesce(_page, 0), 10000)");
    expect(sql).toContain("r.admin_active, r.blocked_on_import");
    expect(sql).toContain("r.linked_auth_user_id");
    expect(sql).toContain("r.phone_e164");
    expect(sql).toContain("INSERT INTO eut_moderation.contact_audit");
    expect(sql).toContain("'reveal_phone'");
    expect(sql).not.toMatch(/auth\.admin|createUser|eut_contact_entitlements|payment_reference/i);
  });

  it("apresenta telefone completo apenas em client-side sob o gate de admin existente", () => {
    expect(page).toContain('roles.includes("admin")');
    expect(page).toContain("<AdminImportedClients />");
    expect(page).toContain('href="#admin-clientes-unificados"');
    expect(ui).toContain('db.rpc("eut_admin_imported_clients"');
    expect(ui).toContain("response.safeParse(data)");
    expect(ui).toContain("item.phone_e164");
    expect(ui).toContain("item.blocked_on_import");
    expect(ui).toContain("login ainda não vinculado");
    expect(ui).toContain('aria-label="Paginação dos clientes da base unificada"');
    expect(ui).not.toMatch(/localStorage|sessionStorage|service_role|auth\.admin/);
    expect(ui).not.toContain("createUser");
    expect(contact).toContain('db.rpc("eut_admin_unified_contact"');
  });
});
