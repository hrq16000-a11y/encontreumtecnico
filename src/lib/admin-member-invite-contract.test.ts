import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");
const sql = read("docs/sql/eut-admin-member-invitations-20261111.sql");
const manager = read("src/components/admin-member-invites.tsx");
const acceptance = read("src/components/member-invite-acceptance.tsx");
const admin = read("src/routes/admin.tsx");
const login = read("src/routes/entrar.tsx");

describe("Convites administrativos para novos técnicos e clientes", () => {
  it("impõe papel de admin, sessão e conta operacional para emitir e revogar", () => {
    for(const guard of [
      "v_actor uuid := auth.uid()",
      "public.has_role(v_actor,'admin'::public.app_role)",
      "eut_migration.confirmed_current_email() IS NULL",
      "public.eut_account_operational()",
      "char_length(v_reason) NOT BETWEEN 8 AND 400",
      "_role NOT IN ('tecnico'::public.app_role,'cliente'::public.app_role)",
      "target_role IN ('tecnico'::public.app_role,'cliente'::public.app_role)",
      "LIMIT 50",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+auth\.users/i);
    expect(sql).not.toContain("auth.admin");
    expect(sql).not.toContain("service_role");
  });
  it("mantém privacidade e moderação com bloqueio de recadastro histórico", () => {
    for (const guard of [
      "ALTER TABLE eut_moderation.member_invitations ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON TABLE eut_moderation.member_invitations FROM PUBLIC,anon,authenticated",
      "eut_migration.legacy_accounts",
      "eut_moderation.blocked_accounts",
      "eut_moderation.blocked_phones",
      "FOR UPDATE",
      "status='pending' AND expires_at>now()",
      "created_at>now()-interval '24 hours'",
      ">=20",
      "public.eut_admin_management_log",
      "'member_invite_created'",
      "'member_invite_revoked'",
      "'member_invite_accepted'",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE)\s+ON\s+(TABLE\s+)?eut_moderation\.member_invitations/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+(auth\.users|public\.user_roles|public\.technicians)/i);
  });
  it("exige e-mail confirmado do destinatário e impede concessão de admin", () => {
    for (const guard of [
      "v_email := lower(btrim(eut_migration.confirmed_current_email()))",
      "WHERE email_normalized=v_email AND status='pending' AND expires_at>now()",
      "EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_actor)",
      "INSERT INTO public.user_roles(user_id,role) VALUES(v_actor,v_role)",
      "GRANT EXECUTE ON FUNCTION public.eut_accept_member_invitation()",
      "REVOKE ALL ON FUNCTION public.eut_accept_member_invitation()",
      "IF has_table_privilege('authenticated','eut_moderation.member_invitations','SELECT')",
    ]) expect(sql).toContain(guard);
    expect(sql).not.toMatch(/VALUES\s*\(\s*v_actor\s*,\s*'admin'/i);
    expect(sql).not.toContain("raw_user_meta_data");
    expect(sql).not.toContain("email_verified_from_frontend");
  });
  it("distribui convites sem envio automático, senha de terceiros ou perfil fake", () => {
    for(const guard of [
      "eut_admin_member_invites_snapshot",
      'db.rpc("eut_admin_member_invite_action"',
      "navigator.clipboard.writeText(message)",
      "window.confirm(",
      "Criar convite auditado",
    ]) expect(manager).toContain(guard);
    for(const guard of [
      'db.rpc("eut_my_member_invitation")',
      'db.rpc("eut_accept_member_invitation")',
      "termsAccepted",
      "await refreshRoles()",
    ]) expect(acceptance).toContain(guard);
    expect(manager).not.toContain("supabase.auth.admin");
    expect(manager).not.toContain("resetPasswordForEmail");
    expect(manager).not.toContain("signUp(");
    expect(manager).not.toContain("sendEmail");
    expect(acceptance).not.toContain("eut_publish_my_technician");
  });
  it("mantém convites para contas e clientes, sem substituir o CRUD de técnicos", () => {
    expect(admin).not.toContain('<AdminMemberInvites initialRole="tecnico" />');
    expect(admin).toContain("<AdminTechnicianUnifiedDirectory adminOwnerId={user.id} />");
    expect(admin).toContain('<AdminMemberInvites initialRole="cliente" />');
    expect(admin).toContain("<AdminMemberInvites /><AdminAccountsManager />");
    expect(login).toContain('<MemberInviteAcceptance userId={user.id} termsAccepted={termsAccepted} refreshRoles={refreshRoles} />');
    expect(login).toContain('supabase.rpc("choose_account_type"');
    expect(admin).toContain('roles.includes("admin")');
  });
});
