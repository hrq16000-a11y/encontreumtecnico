import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  centsToBrl, parseBrlToCents, quoteMercadoPagoAccess,
  validateMercadoPagoSettings, type MercadoPagoSettings,
} from "./mercado-pago-settings";

const settings: MercadoPagoSettings = {
  enabled: false, regular_price_cents: 999, outside_price_cents: 2999,
  regular_from: "09:00", regular_until: "18:00", daily_contact_limit: 2,
  version: 1, updated_at: null,
};

describe("Mercado Pago: validação comercial", () => {
  it("mantém os valores históricos exatamente em centavos", () => {
    expect(parseBrlToCents("9,99")).toBe(999);
    expect(parseBrlToCents("29.99")).toBe(2999);
    expect(parseBrlToCents("1")).toBe(100);
    expect(centsToBrl(999)).toBe("9,99");
    expect(parseBrlToCents("10,00 ")).toBe(1000);
    for (const invalid of ["", "0,99", "999,01", "1e3", "1.111", "1,999", "-9", "10abc"]) {
      expect(parseBrlToCents(invalid)).toBeNull();
    }
  });
  it("recusa dados adulterados e horários sobrepostos", () => {
    expect(validateMercadoPagoSettings(settings)).toEqual(settings);
    for (const invalid of [
      { ...settings, daily_contact_limit: 999 },
      { ...settings, regular_price_cents: -100 },
      { ...settings, regular_price_cents: 999.5 },
      { ...settings, regular_from: "18:00", regular_until: "09:00" },
      { ...settings, regular_from: "9:00" },
      { ...settings, enabled: "true" },
      { ...settings, version: 0 },
      { ...settings, access_token: "NEVER", regular_until: null },
    ]) expect(() => validateMercadoPagoSettings(invalid)).toThrow();
  });
  it("usa início inclusivo e fim exclusivo no fuso São Paulo", () => {
    expect(quoteMercadoPagoAccess(settings, new Date("2026-11-20T11:59:00Z"))).toBe(2999);
    expect(quoteMercadoPagoAccess(settings, new Date("2026-11-20T12:00:00Z"))).toBe(999);
    expect(quoteMercadoPagoAccess(settings, new Date("2026-11-20T20:59:00Z"))).toBe(999);
    expect(quoteMercadoPagoAccess(settings, new Date("2026-11-20T21:00:00Z"))).toBe(2999);
    expect(quoteMercadoPagoAccess({ ...settings, regular_from: "10:00" }, new Date("2026-11-20T12:00:00Z"))).toBe(2999);
    expect(() => quoteMercadoPagoAccess(settings, new Date("bad"))).toThrow();
  });
});

describe("Central financeira: contrato de segurança", () => {
  const sql = readFileSync("docs/sql/eut-mp-owner-settings-20261120.sql", "utf8");
  const ui = readFileSync("src/components/admin-mercado-pago-settings.tsx", "utf8");
  it("começa desligado, sem mexer em compras nem em autorização de contato", () => {
    expect(sql).toContain("enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("NÃO APLICAR AUTOMATICAMENTE");
    expect(sql).not.toMatch(/UPDATE\s+public\.eut_contact_entitlements\b/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.eut_contact_purchase_intents\b/i);
    expect(ui).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET/i);
  });
  it("restringe alterações ao proprietário com sessão real, auditadas e otimistas", () => {
    for (const guard of [
      "project_owner_bootstrap", "auth.sessions", "public.has_role", "public.eut_account_operational",
      "ENABLE ROW LEVEL SECURITY", "REVOKE ALL", "FOR UPDATE", "_expected_version",
      "mp_owner_settings_audit", "_reason", "auth.uid()",
    ]) expect(sql).toContain(guard);
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.eut_admin_mp_update_settings");
    expect(ui).toContain('paymentRpc.rpc("eut_admin_mp_settings")');
    expect(ui).toContain('paymentRpc.rpc("eut_admin_mp_update_settings"');
    expect(ui).toContain("Releitura divergente");
    expect(ui).not.toContain("localStorage");
  });
});
