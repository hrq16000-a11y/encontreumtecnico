import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("docs/sql/eut-sensitive-session-gates-20261111.sql", "utf8");
const smoke = readFileSync("docs/sql/eut-functional-auth-smoke-20261111.sql", "utf8");
describe("EUT — functional identity safety contract", () => {
  it("never allows a nonexistent Auth UUID to be operational", () => {
    expect(sql).toContain("AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=_user_id)");
    expect(smoke).toContain("UUID inexistente foi considerado operacional");
    expect(smoke).toContain("eut_moderation.subject_operational(v_random_id)");
  });
  it("rejects unknown sessions and non-owners with server-side rules", () => {
    expect(smoke).toContain("public.eut_sensitive_session_active()");
    expect(smoke).toContain("eut_owner_admin_invite_action(");
    expect(smoke).toContain("WHEN SQLSTATE '42501'");
    expect(smoke).toContain("eut_moderation.is_verified_invite_owner()");
    expect(smoke).toContain("public.eut_my_admin_invitation()");
  });
  it("does not persist QA identities or alter banned contacts", () => {
    expect(smoke).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE)\s/im);
    expect(smoke).toContain("request.jwt.claims");
    expect(smoke).not.toContain("service_role");
    expect(smoke).toContain("auth.sessions");
  });
});
