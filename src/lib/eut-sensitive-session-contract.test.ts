import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  noJwtWriteTargets, revokedOfflineCases, rollbackInventory, sessionCases,
} from "./eut-sensitive-session-qa-fixtures";

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
    // The proposed SQL also creates/replaces functions. A rollback covering
    // only policies and triggers would leave persistent backend changes.
    for (const functionName of [
      "eut_moderation.subject_operational(uuid)",
      "public.eut_sensitive_session_active()",
      "eut_moderation.guard_sensitive_write()",
    ]) expect(guide).toContain(functionName);
    expect(guide).toContain("Pré-instalação");
    expect(guide).toContain("restaurar sua versão original");
    expect(guide).toContain("Não empregar `DROP ... CASCADE`");
    expect(guide).toContain("PR #133");
    expect(guide).toContain("PR #139");
    expect(guide).toContain("PR #142");
    expect(guide).toContain("Ambiente isolado");
  });
});


/**
 * These are READ-ONLY SQL contract checks and in-memory QA scenarios.
 * They do NOT execute SQL, authenticate against Supabase or prove E2E security.
 */
describe("EUT PR #145 isolated E2E readiness (synthetic fixtures)", () => {
  it.each(sessionCases)("documents session decision for $id", (fixture) => {
    const simulated = fixture.actor !== null
      && fixture.jwtSession !== null
      && fixture.storedSessions.includes(fixture.jwtSession as never)
      && !fixture.banned;
    expect(simulated).toBe(fixture.expected);
    // The real implementation still needs a server-side DB session match.
    expect(sql).toContain("FROM auth.sessions s");
    expect(sql).toContain("s.user_id=auth.uid()");
    expect(sql).toContain("s.id::text=coalesce(auth.jwt()->>'session_id','')");
    expect(sql).toContain("eut_moderation.subject_operational(auth.uid())");
  });

  it("denies null-JWT internal writes before any session exception", () => {
    const deny = sql.indexOf("IF v_user IS NULL THEN");
    const invalid = sql.indexOf("IF NOT public.eut_sensitive_session_active() THEN");
    expect(deny).toBeGreaterThan(-1);
    expect(invalid).toBeGreaterThan(deny);
    expect(sql.slice(deny, invalid)).toContain("RAISE EXCEPTION");
    for (const target of noJwtWriteTargets) {
      expect(sql).toMatch(new RegExp("ON\\s+" + target.replace(".", "\\.") + "\\s*;"));
    }
    // This is a staging compatibility blocker, not permission to bypass
    // the guard for service_role or privileged maintenance.
  });

  it.each(revokedOfflineCases)("specifies the permitted offline-only transition: $id", (fixture) => {
    const changed = (Object.keys(fixture.oldRow) as Array<keyof typeof fixture.oldRow>)
      .filter((field) => fixture.oldRow[field] !== fixture.newRow[field]);
    const allowed = fixture.actor !== null
      && fixture.actor === fixture.oldRow.user_id
      && fixture.actor === fixture.newRow.user_id
      && fixture.newRow.available === false
      && changed.length === 1
      && changed[0] === "available";
    expect(allowed).toBe(fixture.expected);
  });

  it("BLOCKER: exception for a revoked session cannot change unrelated presence fields", () => {
    const start = sql.indexOf("IF TG_TABLE_NAME='eut_technician_presence' AND TG_OP='UPDATE' THEN");
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf("RAISE EXCEPTION", start);
    expect(end).toBeGreaterThan(start);
    const exception = sql.slice(start, end);
    expect(exception).toContain("NEW.available IS FALSE");
    expect(exception).toContain("OLD.user_id=v_user");
    expect(exception).toContain("NEW.user_id=v_user");
    // Fail closed until the proposal verifies that the full row, other than
    // the availability flag, is unchanged. This is deliberately a blocking
    // requirement: matching user_id alone does not enforce it.
    expect(exception).toMatch(
      /to_jsonb\\(NEW\\)\\s*-\\s*'available'\\s*(?:=|IS NOT DISTINCT FROM)\\s*to_jsonb\\(OLD\\)\\s*-\\s*'available'/i,
    );
  });

  it("captures all 3 functions, 5 policies and 5 triggers for complete rollback", () => {
    const functions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION\\s+([a-z_]+\\.[a-z_]+)/gi)]
      .map((match) => match[1]);
    const policies = [...sql.matchAll(/CREATE POLICY\\s+([a-z_]+)/gi)]
      .map((match) => match[1]);
    const triggers = [...sql.matchAll(/CREATE TRIGGER\\s+([a-z_]+)/gi)]
      .map((match) => match[1]);
    expect(functions.sort()).toEqual([...rollbackInventory.functions].sort());
    expect(policies.sort()).toEqual([...rollbackInventory.policies].sort());
    expect(triggers.sort()).toEqual([...rollbackInventory.triggers].sort());
    for (const token of ["definições", "owners", "grants/revokes", "dependências", "existência"]) {
      expect(guide).toContain(token);
    }
    expect(rollbackInventory.priorStateToCapture).toHaveLength(5);
    expect(guide).toContain("restaurar sua versão original");
    expect(guide).toContain("Não empregar `DROP ... CASCADE`");
    // The install SQL contains its own COMMIT: wrapping it in an outer
    // transaction is NOT an automatic rollback guarantee.
    expect(sql).toMatch(/^BEGIN;$/m);
    expect(sql).toMatch(/^COMMIT;$/m);
  });
});
