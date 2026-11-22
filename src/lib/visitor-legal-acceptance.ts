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
