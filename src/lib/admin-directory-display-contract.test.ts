import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("docs/sql/eut-owner-directory-display-20261120.sql", "utf8");
const admin = readFileSync("src/components/admin-directory-display-settings.tsx", "utf8");
const card = readFileSync("src/components/technician-search-card.tsx", "utf8");

describe("contrato privado de configuração da vitrine", () => {
  it("limita mutação ao proprietário real, sessão e controle de concorrência", () => {
    expect(sql).toContain("b.claimed_user_id = auth.uid()");
    expect(sql).toContain("auth.sessions");
    expect(sql).toContain("public.has_role(auth.uid(), 'admin'");
    expect(sql).toContain("public.eut_account_operational()");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_current.version <> _expected_version");
    expect(sql).toContain("directory_display_audit");
    expect(sql).toContain("REVOKE ALL ON TABLE eut_migration.directory_display_audit");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_owner_update_directory_settings(jsonb,integer,text) TO authenticated");
    expect(sql).not.toContain("TO anon, authenticated;\n\nCOMMIT;");
  });

  it("grava com justificativa, releitura e bloqueia formulário sem contrato instalado", () => {
    expect(admin).toContain("eut_owner_directory_settings");
    expect(admin).toContain("eut_owner_update_directory_settings");
    expect(admin).toContain("const reread = await reload()");
    expect(admin).toContain("setSnapshot(null)");
    expect(card).toContain("displaySettings.online_outline");
    expect(card).toContain("displaySettings.enriched_outline");
    expect(card).toContain("displaySettings.photo_outline");
    expect(card).not.toContain("t.phone_number");
  });
});
