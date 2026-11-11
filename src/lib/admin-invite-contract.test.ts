import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
const sql = read("docs/sql/eut-owner-admin-invitations-20261111.sql");
const admin = read("src/components/admin-invites-manager.tsx");
const invitation = read("src/routes/convite-administrativo.tsx");
const parent = read("src/routes/admin.tsx");

describe("Owner-only, confirmed administrative invitations", () => {
  it("checks the verified Google project owner, not editable claims or any admin", () => {
    for (const term of [
      "eut_migration.project_owner_bootstrap",
      "r.role='admin'::public.app_role",
      "u.email_confirmed_at IS NOT NULL",
      "i.provider='google'",
      "b.claimed_user_id IS NULL OR b.claimed_user_id=u.id",
      "IF NOT eut_moderation.is_verified_invite_owner() THEN",
    ]) expect(sql).toContain(term);
    expect(sql).not.toMatch(/(?:raw_user_meta_data|user_metadata)\s*->>\s*'role'/i);
  });
  it("stores private, expiring and auditable invitation state", () => {
    for (const term of [
      "CREATE TABLE IF NOT EXISTS eut_moderation.admin_invitations",
      "CREATE UNIQUE INDEX IF NOT EXISTS eut_admin_invites_one_pending_per_email",
      "interval '48 hours'",
      "ALTER TABLE eut_moderation.admin_invitations ENABLE ROW LEVEL SECURITY",
      "ALTER TABLE eut_moderation.admin_invite_audit ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON TABLE eut_moderation.admin_invitations FROM PUBLIC, anon, authenticated",
      "REVOKE ALL ON TABLE eut_moderation.admin_invite_audit FROM PUBLIC, anon, authenticated",
      "WHERE id=_invite_id FOR UPDATE",
      "ON CONFLICT(user_id,role) DO NOTHING",
    ]) expect(sql).toContain(term);
    expect(sql).not.toMatch(/\b(DELETE\s+FROM|TRUNCATE\s+)\s*(?:auth\.users|public\.user_roles)/i);
  });
  it("validates the invited person's real confirmed email and anti-ban guards", () => {
    for (const term of [
      "CREATE OR REPLACE FUNCTION public.eut_my_admin_invitation()",
      "CREATE OR REPLACE FUNCTION public.eut_accept_admin_invitation(_invite_id uuid)",
      "email_confirmed_at IS NOT NULL",
      "email_normalized=v_email",
      "expires_at>now()",
      "eut_moderation.blocked_accounts",
      "eut_moderation.blocked_phones",
      "status='accepted'",
    ]) expect(sql).toContain(term);
    expect(sql).not.toContain("auth.admin");
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+auth\.users/i);
  });
  it("does not expose privileged mutation to anon or direct table writes", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_owner_admin_invite_action(text,text,uuid,text)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_accept_admin_invitation(uuid)");
    expect(sql).toContain("has_function_privilege('anon'");
    expect(sql).toContain("has_table_privilege('authenticated'");
  });
  it("includes isolated owner UI and authenticated acceptance without secrets", () => {
    expect(parent).toContain("<AdminInvitesManager />");
    expect(admin).toContain('db.rpc("eut_owner_admin_invites_snapshot")');
    expect(admin).toContain('db.rpc("eut_owner_admin_invite_action"');
    expect(admin).toContain("window.confirm");
    expect(admin).toContain("/convite-administrativo");
    expect(invitation).toContain('db.rpc("eut_my_admin_invitation")');
    expect(invitation).toContain('db.rpc("eut_accept_admin_invitation"');
    expect(invitation).toContain("await refreshRoles()");
    expect(invitation).toContain("noindex, nofollow");
    expect(admin + invitation).not.toContain("service_role");
  });
});
