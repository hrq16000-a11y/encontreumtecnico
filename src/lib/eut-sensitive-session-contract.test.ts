import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("docs/sql/eut-sensitive-session-gates-20261111.sql", "utf8");
const guide = readFileSync("docs/admin/EUT_SESSION_GATES_2026-11-11.md", "utf8");

describe("EUT restricted accounts and live Auth sessions", () => {
  it("cross-checks a server-side Auth session instead of trusting a JWT by itself", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.eut_sensitive_session_active()");
    expect(sql).toContain("FROM auth.sessions s");
    expect(sql).toContain("s.user_id=auth.uid()");
    expect(sql).toContain("s.id::text=coalesce(auth.jwt()->>'session_id','')");
    expect(sql).toContain("eut_moderation.subject_operational(auth.uid())");
    expect(sql).toContain("eut_moderation.blocked_accounts");
    expect(sql).toContain("eut_moderation.blocked_phones");
    expect(sql).toContain("EXISTS (SELECT 1 FROM auth.users u WHERE u.id=_user_id)");
    expect(sql).not.toMatch(/\b(user_metadata|raw_user_meta_data)\b/);
  });

  it("keeps controls private without exposing another person's ban status", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION eut_moderation.subject_operational(uuid)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION eut_moderation.guard_sensitive_write()");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_sensitive_session_active()");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_sensitive_session_active()");
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("has_function_privilege('anon'");
    expect(sql).not.toMatch(/\b(DELETE|TRUNCATE)\s+(FROM\s+)?auth\.(users|sessions)\b/i);
  });

  it("limits reads of private requests and claims, and prevents private writes", () => {
    for (const name of [
      "eut_session_private_requests",
      "eut_session_direct_consents",
      "eut_session_legacy_claims_read",
      "eut_session_legacy_claims_create",
      "eut_session_technician_updates",
    ]) expect(sql).toContain(name);
    expect(sql.match(/AS RESTRICTIVE FOR/g)?.length).toBe(5);
    expect(sql).toContain("AS RESTRICTIVE FOR UPDATE TO authenticated");
    expect(sql).toContain("USING ((SELECT public.eut_sensitive_session_active()))");
    expect(sql).toContain("WITH CHECK ((SELECT public.eut_sensitive_session_active()))");
  });

  it("protects SECURITY DEFINER destinations without restricting admin target moderation", () => {
    for (const table of [
      "public.technicians",
      "public.eut_technician_presence",
      "public.eut_direct_request_replies",
      "public.eut_direct_request_consents",
      "public.eut_technician_referrals",
    ]) expect(sql).toContain("ON " + table);
    expect(sql.match(/CREATE TRIGGER eut_active_session_/g)?.length).toBe(5);
    expect(sql).toContain("public.eut_sensitive_session_active()");
    expect(sql).toContain("NEW.technician_user_id");
    expect(sql).toContain("NEW.client_id");
    expect(sql).toContain("NEW.technician_id");
    expect(sql).toContain("NEW.invited_user_id");
    expect(sql).toContain("NEW.inviter_user_id");
    expect(sql).toContain("NEW.available IS FALSE");
    expect(sql).toContain("IF v_user IS NULL THEN");
    expect(sql).toMatch(/IF v_user IS NULL THEN\s*RAISE EXCEPTION[\s\S]*?USING ERRCODE='42501';\s*END IF;/);
    expect(sql).not.toContain("IF v_user IS NOT NULL AND NOT public.eut_sensitive_session_active()");
    expect(sql).toContain("IF TG_TABLE_NAME='eut_technician_presence' AND TG_OP='UPDATE' THEN");
    expect(sql).toContain("NEW.user_id=v_user");
    expect(sql).toContain("OLD.user_id=v_user");
    expect(sql).not.toMatch(/AND NEW.available IS FALSE THEN\s*RETURN NEW;/);
    expect(sql).toContain("IF NOT public.eut_sensitive_session_active() THEN");
  });

  it("documents session revocation limitations and requires real E2E before activation", () => {
    expect(guide).toContain("não revoga refresh tokens");
    expect(guide).toContain("Auth Hook");
    expect(guide).toContain("rollback");
    expect(guide).toContain("PR #133");
    expect(guide).toContain("PR #139");
    expect(guide).toContain("PR #142");
    expect(guide).toContain("Ambiente isolado");
  });
});
