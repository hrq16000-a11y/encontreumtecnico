import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
const lockSql = read("docs/sql/eut-member-invite-actor-lock-20261111.sql");
const original = read("docs/sql/eut-admin-member-invitations-20261111.sql");
const page = read("src/routes/admin.tsx");
const gate = read(".github/workflows/eut-admin-control-center.yml");

describe("Micro-rodada: convites concorrentes e privacidade de clientes", () => {
  it("serializa emissões por administrador ANTES da contagem de 20 convites, preservando o lock por e-mail", () => {
    const actor = lockSql.indexOf("pg_advisory_xact_lock(hashtext('eut-member-invite-actor:'||v_actor::text))");
    const email = lockSql.indexOf("pg_advisory_xact_lock(hashtext('eut-member-invite:'||v_email))");
    const existing = lockSql.indexOf("Já existe um convite pendente");
    const limit = lockSql.indexOf("created_by=v_actor AND created_at>now()-interval '24 hours'");
    const insert = lockSql.indexOf("INSERT INTO eut_moderation.member_invitations");
    expect(actor).toBeGreaterThan(0);
    expect(email).toBeGreaterThan(actor);
    expect(existing).toBeGreaterThan(email);
    expect(limit).toBeGreaterThan(existing);
    expect(insert).toBeGreaterThan(limit);
    expect(lockSql).toContain(">=20");
    expect(lockSql).toContain("status='pending' AND expires_at<=now()");
  });

  it("mantém autenticação, moderação, papéis permitidos e auditoria ao trocar a função", () => {
    for (const guard of [
      "v_actor uuid := auth.uid()",
      "public.has_role(v_actor,'admin'::public.app_role)",
      "eut_migration.confirmed_current_email() IS NULL",
      "public.eut_account_operational()",
      "eut_moderation.blocked_accounts",
      "eut_moderation.blocked_phones",
      "eut_migration.legacy_accounts",
      "WHERE id=_invite_id AND status='pending' FOR UPDATE",
      "'member_invite_created'",
      "'member_invite_revoked'",
      "SECURITY DEFINER",
      "SET search_path='pg_catalog'",
      "REVOKE ALL ON FUNCTION public.eut_admin_member_invite_action",
      "GRANT EXECUTE ON FUNCTION public.eut_admin_member_invite_action",
    ]) expect(lockSql).toContain(guard);
    expect(lockSql).not.toMatch(/DELETE\s+FROM\s+(?:auth\.users|public\.user_roles)/i);
    expect(lockSql).not.toMatch(/GRANT\s+(?:INSERT|UPDATE|DELETE)\s+ON\s+(?:TABLE\s+)?eut_moderation\.member_invitations/i);
    expect(lockSql).not.toContain("INSERT INTO auth.users");
    expect(lockSql).not.toContain("service_role");
    expect(original).toContain("WHERE email_normalized=v_email AND status='pending' AND expires_at>now()");
    expect(original).toContain("INSERT INTO public.user_roles(user_id,role) VALUES(v_actor,v_role)");
    expect(original).not.toContain("INSERT INTO public.user_roles(user_id,role) VALUES(v_actor,'admin'");
  });

  it("não carrega pedidos privados nem contagens truncadas na aba Clientes", () => {
    expect(page).toContain('const needsRequests = section === "inicio" || section === "solicitacoes";');
    expect(page).not.toContain('|| section === "clientes";');
    expect(page).toContain('<AdminAccountsManager initialFilter="clientes" />');
    expect(page).toContain('<AdminMemberInvites initialRole="cliente" />');
    expect(page).toContain("Descrições dos problemas");
    expect(page).toContain("não são carregados desnecessariamente");
    expect(page).not.toContain("Solicitantes nessas solicitações");
    expect(page).not.toContain("Solicitações consultadas");
  });

  it("CI continua verificando moderação e inclui a nova proteção sem gatilhos de path inválidos", () => {
    for (const path of [
      "'src/lib/admin-account-moderation-contract.test.ts'",
      "'src/lib/admin-member-invite-contract.test.ts'",
      "'src/lib/eut-invite-client-privacy.test.ts'",
      "'docs/sql/eut-member-invite-actor-lock-20261111.sql'",
    ]) expect(gate).toContain(path);
    expect(gate).not.toContain("'src/lib/admin-account-moderation-contract.test.ts src/lib/admin-member-invite-contract.test.ts'");
    expect(gate).toContain("src/lib/eut-invite-client-privacy.test.ts");
    expect(gate).toContain("bun run build");
    expect(gate).toContain("bunx tsc --noEmit");
  });
});
