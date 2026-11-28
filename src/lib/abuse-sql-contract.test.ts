import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const sql=readFileSync("docs/sql/eut-abuse-progressive-phase4-20261122.sql","utf8");
const component=readFileSync("src/components/admin-abuse-controls.tsx","utf8");
const shell=readFileSync("src/routes/admin.tsx","utf8");
describe("Fase 4 — contratos de segurança e administração não ativados",()=>{
  it("somente eventos comprovados no servidor, sessão autenticada e serialização por ator e ação",()=>{
    for(const part of ["CREATE TABLE IF NOT EXISTS eut_moderation.eut_abuse_action_state",
      "CREATE TABLE IF NOT EXISTS eut_moderation.eut_abuse_admin_audit",
      "pg_advisory_xact_lock","FOR UPDATE","auth.uid()",
      "REVOKE ALL ON eut_moderation.eut_abuse_action_state FROM PUBLIC,anon,authenticated",
      "REVOKE ALL ON eut_moderation.eut_abuse_admin_audit FROM PUBLIC,anon,authenticated",
      "GRANT EXECUTE ON FUNCTION eut_moderation.eut_abuse_record_verified_failure(uuid,text) TO service_role",
      "GRANT EXECUTE ON FUNCTION eut_moderation.eut_abuse_decision(uuid,text) TO service_role",
      "RETURN jsonb_build_object('allowed',false",
    ]) expect(sql).toContain(part);
    expect(sql).not.toContain("CREATE TRIGGER ");
    expect(sql).not.toContain("DROP POLICY");
    expect(sql).not.toContain("DELETE FROM public.");
    expect(sql).not.toContain("raw_user_meta_data");
  });
  it("as ações existentes de moderação permanecem separadas do cooldown",()=>{
    expect(sql).toContain("public.has_role(v_admin,'admin'::public.app_role)");
    expect(sql).toContain("email_confirmed_at IS NOT NULL");
    expect(sql).toContain("eut_admin_abuse_release");
    expect(sql).toContain("INSERT INTO eut_moderation.eut_abuse_admin_audit");
    expect(sql).not.toContain("UPDATE eut_moderation.blocked_accounts");
    expect(sql).not.toContain("UPDATE eut_moderation.blocked_phones");
    expect(component).toContain("readback_failed");
    expect(component).toContain("window.confirm");
    expect(component).toContain('VITE_EUT_ABUSE_ADMIN_ENABLED');
    expect(shell).toContain("<AdminAbuseControls />");
  });
  it("Fase 3 segue NO-GO e nenhuma flag é ligada no repositório",()=>{
    expect(component).toContain("A/B/C: NO-GO");
    expect(component).not.toContain("VITE_EUT_VISITOR_ANALYTICS_ENABLED");
    expect(sql).toContain("DO NOT APPLY");
    expect(sql).not.toContain("CREATE EXTENSION");
    expect(sql).not.toContain("cron.schedule");
  });
});
