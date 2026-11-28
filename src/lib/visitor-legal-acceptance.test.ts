import { describe, expect, it } from "vitest";
import { EUT_PRIVACY_VERSION, EUT_TERMS_VERSION } from "./visitor-consent";
import { pendingAcceptanceForAccount } from "./visitor-legal-acceptance";
import { readFileSync } from "node:fs";

const account = "00000000-0000-4000-8000-000000000001";
function saved(userId: string, createdAt = 1000) {
  return JSON.stringify({ userId, terms: EUT_TERMS_VERSION,
    privacy: EUT_PRIVACY_VERSION, createdAt });
}
describe("Fase 3 — aceite versionado do titular", () => {
  it("intenção de aceite após email pertence somente ao usuário de mesmo UUID", () => {
    expect(pendingAcceptanceForAccount(saved(account), account, 2000)).toBe(true);
    expect(pendingAcceptanceForAccount(saved(account), "00000000-0000-4000-8000-000000000002", 2000)).toBe(false);
    expect(pendingAcceptanceForAccount(null, account)).toBe(false);
    expect(pendingAcceptanceForAccount("{broken", account)).toBe(false);
    expect(pendingAcceptanceForAccount(saved(account), account, 1000+72*60*60*1000+1)).toBe(false);
    expect(pendingAcceptanceForAccount(saved(account, 2000), account, 1000)).toBe(false);
  });
  it("checkbox de Termos é independente de cookies e registro no servidor", () => {
    const login = readFileSync("src/routes/entrar.tsx", "utf8");
    const invite = readFileSync("src/components/member-invite-acceptance.tsx", "utf8");
    const receipts = readFileSync("docs/sql/eut-visitor-ledger-phase3-20261122.sql", "utf8");
    for (const required of ["persistMyLegalAcceptance", "termsAccepted",
      "rememberEmailSignupAcceptance", "flushPendingLegalAcceptance",
      "linkThisVisitToMyAccount"]) expect(login).toContain(required);
    expect(invite).toContain("persistMyLegalAcceptance(termsAccepted)");
    expect(receipts).toContain("DECLARE v_actor uuid := auth.uid()");
    expect(receipts).toContain("accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()");
    expect(receipts).toContain("ON CONFLICT(account_id,terms_version,privacy_version) DO NOTHING");
    expect(receipts).not.toContain("INSERT INTO public.user_roles");
    expect(receipts).not.toContain("UPDATE public.technicians");
  });
});
