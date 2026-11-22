import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const sql = readFileSync("docs/sql/eut-visitor-ledger-phase3-20261122.sql", "utf8");
describe("Fase 3 SQL — segurança e retenção (contrato não instalado)", () => {
  it("três camadas separadas, RLS e nenhum acesso bruto ao cliente", () => {
    for(const name of ["eut_visit_access_records","eut_visitor_security_events",
      "eut_visitor_optin_events","eut_visitor_account_conversions","eut_account_legal_receipts"]) {
      expect(sql).toContain("eut_moderation."+name);
      expect(sql).toContain("ALTER TABLE eut_moderation."+name+" ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain("REVOKE ALL ON eut_moderation."+name+" FROM PUBLIC, anon, authenticated");
    }
    expect(sql).not.toContain("GRANT SELECT ON eut_moderation.");
  });
  it("ingress A e B sem acesso anônimo, C limitada, legal só titular", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_visitor_access_ingest(text) TO service_role");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_visitor_security_ingest(text,text) TO service_role");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_visitor_optin_event(uuid,text,text) TO anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_accept_legal_versions(text,text) TO authenticated");
    expect(sql).toContain("DECLARE v_actor uuid := auth.uid()");
    expect(sql).not.toContain("user_metadata");
    expect(sql).not.toContain("client_ip");
  });
  it("retém acesso seis meses; segurança e métricas têm prazos separados", () => {
    expect(sql).toContain("INTERVAL '6 months'");
    expect(sql).toContain("INTERVAL '90 days'");
    expect(sql).toContain("INTERVAL '30 days'");
    expect(sql).toContain("legal_hold_until");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_visitor_retention_purge(integer) TO service_role");
    expect(sql).not.toContain("CREATE EXTENSION");
    expect(sql).not.toContain("cron.schedule");
  });
});
