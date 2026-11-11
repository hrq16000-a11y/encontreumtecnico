import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
const sql = read("docs/sql/eut-admin-accounts-moderation-20261111.sql");
const accounts = read("src/components/admin-accounts-manager.tsx");
const admin = read("src/routes/admin.tsx");
const navigation = read("src/components/admin-navigation.tsx");
const hub = read("src/components/admin-control-hub.tsx");

describe("Account moderation security contract", () => {
  it("fails closed on new client requests, technician registration and direct sharing", () => {
    for (const term of [
      "CREATE POLICY eut_clients_not_restricted ON public.service_requests",
      "AS RESTRICTIVE FOR INSERT TO authenticated",
      "CREATE POLICY eut_new_technicians_not_restricted ON public.technicians",
      "CREATE TRIGGER eut_guard_blocked_user_roles BEFORE INSERT",
      "CREATE TRIGGER eut_guard_blocked_direct_share BEFORE INSERT",
      "eut_moderation.blocked_accounts",
      "eut_moderation.blocked_phones",
      "auth.uid()",
      "CREATE OR REPLACE FUNCTION public.eut_account_operational()",
    ]) expect(sql).toContain(term);
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_account_operational() TO authenticated");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_account_operational() FROM PUBLIC,anon,authenticated");
    expect(sql).not.toMatch(/DELETE FROM (?:auth\.users|public\.technicians|public\.legacy_review_profiles)/i);
  });

  it("allows only real admin roles to read a minimized private account directory", () => {
    for (const term of [
      "CREATE OR REPLACE FUNCTION public.eut_admin_accounts_snapshot",
      "SECURITY DEFINER SET search_path='pg_catalog'",
      "public.has_role(auth.uid(),'admin'::public.app_role)",
      "REVOKE ALL ON FUNCTION public.eut_admin_accounts_snapshot",
      "GRANT EXECUTE ON FUNCTION public.eut_admin_accounts_snapshot",
      "masked_email", "masked_phone", "blocked_account", "blocked_phone",
      "LIMIT 20 OFFSET v_page*20",
    ]) expect(sql).toContain(term);
    expect(sql).toContain("v_filter NOT IN ('todos','tecnicos','clientes','sem_papel','bloqueados')");
    expect(sql).not.toContain("SELECT * FROM auth.users");
    expect(sql).not.toContain("raw_user_meta_data->>'role'");
  });

  it("edits only account names with reason and immutable audit", () => {
    for (const term of [
      "CREATE OR REPLACE FUNCTION public.eut_admin_account_edit_name",
      "target_type IN ('technician','legacy_review','account')",
      "Conta administrativa protegida",
      "UPDATE SET full_name=EXCLUDED.full_name",
      "public.eut_admin_management_log",
      "REVOKE ALL ON FUNCTION public.eut_admin_account_edit_name",
    ]) expect(sql).toContain(term);
    expect(sql).not.toMatch(/UPDATE\s+auth\.users/i);
    expect(accounts).toContain('db.rpc("eut_admin_account_edit_name"');
  });

  it("connects separate client and global accounts pages to audited existing admin RPC", () => {
    expect(accounts).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(accounts).toContain('db.rpc("eut_admin_contact_action"');
    expect(accounts).toContain("data?.action !== selection.action");
    for (const action of ["block_account", "unblock_account", "block_phone", "unblock_phone"]) {
      expect(accounts).toContain(action);
    }
    expect(accounts).toContain("window.confirm");
    expect(accounts).not.toContain("auth.admin.");
    expect(accounts).not.toContain("service_role");
    expect(admin).toContain('section === "contas"');
    expect(admin).toContain('<AdminAccountsManager initialFilter="clientes" />');
    expect(navigation).toContain("contas: ShieldBan");
    expect(hub).toContain('key: "contas"');
  });

  it("does not overclaim provider-level or new email registration bans", () => {
    expect(accounts).toContain("não elimina o login no provedor Google");
    expect(accounts).toContain("Auth Hook do Supabase");
    expect(accounts).toContain("exclusão definitiva não estão habilitadas");
  });
});
