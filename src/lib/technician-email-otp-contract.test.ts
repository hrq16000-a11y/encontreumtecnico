import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(),
  "docs/sql/eut-technician-email-otp-proof-20261120.sql"), "utf8");
const rollbackSql = readFileSync(resolve(process.cwd(),
  "docs/sql/eut-technician-email-otp-proof-rollback-20261120.sql"), "utf8");

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
    expect(sql).toContain("technician_email_otp_challenges");
    expect(sql).toContain("v_requested_email IS DISTINCT FROM v_email");
    expect(sql).toContain("v_sent_at NOT BETWEEN v_requested_at");
    expect(sql).toContain("v_authenticated_at NOT BETWEEN v_sent_at");
    expect(sql).not.toContain("v_sent_at NOT BETWEEN v_authenticated_at");
    expect(sql).toContain("bf0789e2b311454a6320ecdc5269e73f");
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
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.eut_begin_technician_email_otp() FROM PUBLIC, anon, authenticated");
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM)\s+auth\.users\b/i);
    expect(sql).not.toMatch(/(?:UPDATE|DELETE FROM)\s+public\.technicians\b/i);
  });
  it("revoga a prova antiga em toda mudança real de email, inclusive na volta ao anterior", () => {
    expect(sql).toContain("AFTER UPDATE OF email ON auth.users");
    expect(sql).toContain("OLD.email IS DISTINCT FROM NEW.email");
    expect(sql).toContain("SET revoked_at=coalesce(p.revoked_at,clock_timestamp())");
    expect(sql).toContain("AND p.revoked_at IS NULL");
    expect(sql).toContain("revoked_at=NULL");
    expect(rollbackSql).toContain("DROP TRIGGER IF EXISTS eut_revoke_technician_email_otp_on_email_change ON auth.users");
  });
  it("bloqueia rollback após qualquer alteração das funções ou do gatilho OTP", () => {
    // O fingerprint é calculado do SQL de instalação, não de um hash fixo no teste.
    for (const signature of [
      "eut_migration.confirmed_current_email()",
      "eut_migration.revoke_technician_email_otp_on_email_change()",
      "public.eut_begin_technician_email_otp()",
      "public.eut_attest_technician_email_otp()",
    ]) {
      const marker = `CREATE OR REPLACE FUNCTION ${signature}`;
      const start = sql.indexOf(marker);
      expect(start).toBeGreaterThanOrEqual(0);
      const source = sql.slice(start).match(/AS \$function\$([\s\S]*?)\$function\$;/)?.[1];
      expect(source).toBeDefined();
      const hash = createHash("md5").update(source!, "utf8").digest("hex");
      expect(rollbackSql).toContain(`IS DISTINCT FROM '${hash}'`);
      expect(rollbackSql).toContain(`to_regprocedure('${signature}')`);
    }
    expect(rollbackSql).toContain("t.tgrelid='auth.users'::regclass");
    expect(rollbackSql).toContain("t.tgfoid=to_regprocedure('eut_migration.revoke_technician_email_otp_on_email_change()')");
    expect(rollbackSql).toContain("t.tgenabled='O'");
    expect(rollbackSql).toContain("old.email is distinct from new.email");
    expect(rollbackSql.indexOf("DO $preflight$")).toBeLessThan(
      rollbackSql.indexOf("DROP TRIGGER IF EXISTS"));
    expect(rollbackSql).toContain("USING ERRCODE='P0001'");
  });

  it("oferece rollback sem apagar provas privadas ou contas", () => {
    expect(rollbackSql).toContain("REVOKE ALL ON FUNCTION public.eut_begin_technician_email_otp()");
    expect(rollbackSql).toContain("REVOKE ALL ON FUNCTION public.eut_attest_technician_email_otp()");
    expect(rollbackSql).toContain("CREATE OR REPLACE FUNCTION eut_migration.confirmed_current_email()");
    expect(rollbackSql).toContain("bf0789e2b311454a6320ecdc5269e73f");
    expect(rollbackSql).not.toMatch(/^DROP TABLE/im);
    expect(rollbackSql).not.toMatch(/^DELETE FROM/im);
  });
});
