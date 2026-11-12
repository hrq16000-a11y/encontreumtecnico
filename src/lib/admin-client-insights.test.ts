import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (file: string) => readFileSync(file, "utf8");
const sql = read("docs/sql/eut-admin-client-insights-20261111.sql");
const ui = read("src/components/admin-client-insights.tsx");
const admin = read("src/routes/admin.tsx");
const accounts = read("src/components/admin-accounts-manager.tsx");
const qa = read("docs/qa/EUT_CLIENT_INVITES_E2E_20261111.md");

describe("Admin: indicadores e histórico de clientes sem dados pessoais", () => {
  it("não permite RPC anônima, papel comum nem acesso direto à tabela privada", () => {
    for(const guard of [
      "auth.uid() IS NULL",
      "public.has_role(auth.uid(), 'admin'::public.app_role)",
      "public.eut_account_operational()",
      "SECURITY DEFINER",
      "SET search_path = 'pg_catalog'",
      "REVOKE ALL ON FUNCTION public.eut_admin_client_insights",
      "FROM PUBLIC, anon, authenticated",
      "GRANT EXECUTE ON FUNCTION public.eut_admin_client_insights",
      "TO authenticated",
      "has_table_privilege('authenticated','eut_moderation.member_invitations','SELECT')",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/INSERT INTO|DELETE FROM|UPDATE\s+(?:auth\.users|public\.user_roles|eut_moderation\.)/i);
    expect(sql).not.toContain("service_role");
    expect(sql).not.toContain("raw_user_meta_data");
  });
  it("conta clientes reais, confirmados, restritos e convites ativos sem amostra limitada", () => {
    for(const guard of [
      "SELECT DISTINCT user_id FROM public.user_roles",
      "WHERE role = 'cliente'::public.app_role",
      "u.email_confirmed_at IS NOT NULL",
      "eut_moderation.blocked_accounts",
      "eut_moderation.blocked_phones",
      "target_role = 'cliente'::public.app_role",
      "status = 'pending' AND expires_at > now()",
      "'clients_total'",
      "'clients_confirmed'",
      "'clients_unconfirmed'",
      "'clients_restricted'",
      "'pending_client_invites'",
    ]) expect(sql).toContain(guard);
    expect(ui).toContain("não são estimativas da página atual");
    expect(ui).toContain("Contagens completas calculadas no banco");
    expect(ui).not.toContain("localStorage");
    expect(ui).not.toContain("service_requests");
  });
  it("consulta auditoria paginada no servidor, com filtros restritos", () => {
    for (const guard of [
      "v_filter NOT IN ('todos', 'contas', 'convites', 'bloqueios')",
      "LIMIT 20 OFFSET v_page*20",
      "v_page integer := greatest(0, least(coalesce(_page, 0), 10000))",
      "eut_moderation.contact_audit",
      "public.eut_admin_management_log",
      "a.target_type = 'account'",
      "WHERE (v_filter = 'todos' OR kind = v_filter)",
      "'audit_total'",
      "'audit_page_size', 20",
    ]) expect(sql).toContain(guard);
    for (const guard of [
      'db.rpc("eut_admin_client_insights"',
      "_audit_filter: filter, _page: page, _subject_user_id: null",
      'aria-label="Paginação do histórico de clientes"',
      "setPage(0)",
      "Nenhum evento neste filtro",
    ]) expect(ui).toContain(guard);
    expect(sql).not.toContain("u.email AS");
    expect(sql).not.toContain("SELECT * FROM auth.users");
    expect(ui).not.toContain("phone_e164");
  });
  it("mantém a gestão existente com 20 contas por página e preserva filtros e banimentos", () => {
    expect(accounts).toContain('db.rpc("eut_admin_accounts_snapshot"');
    expect(accounts).toContain("_search: search, _filter: filter, _page: page");
    expect(admin).toContain('<AdminClientInsights />');
    expect(admin).toContain('<AdminAccountsManager initialFilter="clientes" />');
    expect(admin).toContain('<AdminMemberInvites initialRole="cliente" />');
    expect(admin).toContain('roles.includes("admin")');
    expect(admin).not.toContain("auth.admin.deleteUser");
  });
  it("prepara aceite E2E sem criar contas de terceiros ou usar identidades reais", () => {
    for (const guard of ["Duas identidades de QA", "72h", "ROLLBACK", "não executados", "Nenhum convite real"]) {
      expect(qa).toContain(guard);
    }
    expect(qa).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
