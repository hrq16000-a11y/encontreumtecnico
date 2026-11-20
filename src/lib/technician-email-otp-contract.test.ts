import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(),
  "docs/sql/eut-technician-email-otp-proof-20261120.sql"), "utf8");

describe("Contrato auditável de titularidade de e-mail do técnico", () => {
  it("mantém o histórico atual e não aceita autoconfirmação isolada", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION eut_migration.confirmed_current_email()");
    expect(sql).toContain("u.confirmation_sent_at IS NOT NULL");
    expect(sql).toContain("u.email_confirmed_at >= u.confirmation_sent_at");
    expect(sql).toContain("i.provider='google'");
    expect(sql).toContain("technician_email_otp_proofs p");
    expect(sql).toContain("p.verified_email=lower(btrim(u.email))");
  });
  it("só atesta o próprio técnico após login OTP no e-mail e sessão válida", () => {
    expect(sql).toContain("v_user uuid := auth.uid()");
    expect(sql).toContain("v_claims jsonb := auth.jwt()");
    expect(sql).toContain("v_claims->>'session_id'");
    expect(sql).toContain("s.id=v_session AND s.user_id=v_user");
    expect(sql).toContain("v_authenticated_at NOT BETWEEN now()-interval '15 minutes'");
    expect(sql).toContain("u.recovery_sent_at");
    expect(sql).toContain("i.provider='email'");
    expect(sql).toContain("i.provider='phone'");
    expect(sql).toContain("public.eut_account_operational()");
    expect(sql).toContain("public.has_role(v_user,'tecnico'::public.app_role)");
  });
  it("mantém o comprovante privado e sem autorização anônima", () => {
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON TABLE eut_migration.technician_email_otp_proofs FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_attest_technician_email_otp() FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_attest_technician_email_otp() TO authenticated");
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM)\s+auth\.users\b/i);
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM)\s+public\.technicians\b/i);
  });
});
