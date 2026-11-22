import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { EUT_PRIVACY_VERSION, EUT_TERMS_VERSION } from "@/lib/visitor-consent";

const db = supabase as unknown as SupabaseClient;

/** Requires authenticated user's explicit checkbox. The database assigns accepted_at and
 * derives account_id from auth.uid(), never from browser-supplied user identifiers.
 */
export async function persistMyLegalAcceptance(checked: boolean): Promise<boolean> {
  if (!checked) return false;
  // This gate prevents half-activated deployments from breaking existing onboarding.
  if (import.meta.env["VITE_EUT_LEGAL_RECEIPT_ENABLED"] !== "true") return true;
  try {
    const { data, error } = await db.rpc("eut_accept_legal_versions", {
      _terms_version: EUT_TERMS_VERSION,
      _privacy_version: EUT_PRIVACY_VERSION,
    });
    return !error && data?.ok === true &&
      data?.terms_version === EUT_TERMS_VERSION && data?.privacy_version === EUT_PRIVACY_VERSION;
  } catch { return false; }
}

export function legalReceiptRequired(): boolean {
  return import.meta.env["VITE_EUT_LEGAL_RECEIPT_ENABLED"] === "true";
}

const PENDING_KEY = "eut-pending-legal-acceptance-v1";
const INTENT_TTL = 72 * 60 * 60 * 1000;
type PendingLegal = { userId: string; terms: string; privacy: string; createdAt: number };

/** Only the just-created account may claim a previous checkbox after email confirmation. */
export function pendingAcceptanceForAccount(raw: string | null, userId: string, now = Date.now()): boolean {
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as Partial<PendingLegal>;
    return data.userId === userId && data.terms === EUT_TERMS_VERSION &&
      data.privacy === EUT_PRIVACY_VERSION && typeof data.createdAt === "number" &&
      data.createdAt <= now && now - data.createdAt <= INTENT_TTL;
  } catch { return false; }
}

export function rememberEmailSignupAcceptance(userId: string | null, checked: boolean) {
  if (!checked || !userId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) return;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({
      userId, terms: EUT_TERMS_VERSION, privacy: EUT_PRIVACY_VERSION, createdAt: Date.now(),
    } satisfies PendingLegal));
  } catch { /* no storage available */ }
}

/** Return 'failed' only for a matching account with the schema explicitly enabled.
 * No account can inherit another person's pending acceptance.
 */
export async function flushPendingLegalAcceptance(userId: string): Promise<"none" | "confirmed" | "failed"> {
  if (!legalReceiptRequired() || typeof sessionStorage === "undefined") return "none";
  let stored: string | null;
  try { stored = sessionStorage.getItem(PENDING_KEY); } catch { return "none"; }
  if (!pendingAcceptanceForAccount(stored,userId)) return "none";
  if (!(await persistMyLegalAcceptance(true))) return "failed";
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* okay */ }
  return "confirmed";
}
