import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  EUT_COOKIE_KEY, EUT_VISITOR_CONSENT_VERSION, VISITOR_SESSION_KEY,
  isVisitorLedgerClientEnabled, parseVisitorToken, publicPageKind, visitorConsentAllowed,
} from "@/lib/visitor-consent";

type EventKind = "consent_granted" | "consent_revoked" | "view_home" | "view_directory" | "view_services" | "view_guides";
const db = supabase as unknown as SupabaseClient;

function inBrowser() { return typeof window !== "undefined" && typeof sessionStorage !== "undefined"; }

/** Session-scoped, random pseudonym; never derived from fingerprint, IP, device or user account. */
export function currentVisitorToken(create: boolean): string | null {
  if (!inBrowser()) return null;
  try {
    const found = parseVisitorToken(sessionStorage.getItem(VISITOR_SESSION_KEY));
    if (found) return found.token;
    sessionStorage.removeItem(VISITOR_SESSION_KEY);
    if (!create) return null;
    const token = crypto.randomUUID();
    sessionStorage.setItem(VISITOR_SESSION_KEY, JSON.stringify({ token, issuedAt: Date.now() }));
    return token;
  } catch { return null; }
}

/** This is an optional analytics signal, not proof of a legal agreement. */
export async function writeVisitorOptInEvent(kind: EventKind): Promise<boolean> {
  if (!inBrowser() || !isVisitorLedgerClientEnabled()) return false;
  if (kind !== "consent_revoked" && !visitorConsentAllowed(localStorage.getItem(EUT_COOKIE_KEY))) return false;
  const token = currentVisitorToken(kind !== "consent_revoked");
  if (!token) return false;
  try {
    const { data, error } = await db.rpc("eut_visitor_optin_event", {
      _visitor_token: token, _event_kind: kind, _consent_version: EUT_VISITOR_CONSENT_VERSION,
    });
    return !error && data?.ok === true;
  } catch { return false; }
  finally {
    if (kind === "consent_revoked") {
      try { sessionStorage.removeItem(VISITOR_SESSION_KEY); } catch { /* no storage access */ }
    }
  }
}

const seenGroups = new Set<string>();
export async function recordConsentedPageGroup(pathname: string): Promise<boolean> {
  if (!inBrowser() || !isVisitorLedgerClientEnabled() ||
      !visitorConsentAllowed(localStorage.getItem(EUT_COOKIE_KEY))) return false;
  const group = publicPageKind(pathname);
  if (!group || seenGroups.has(group)) return false;
  seenGroups.add(group);
  return writeVisitorOptInEvent(("view_" + group) as EventKind);
}

/** Explicit self-account conversion only; never links history on login or by shared IP. */
export async function linkThisVisitToMyAccount(explicitOptIn: boolean): Promise<boolean> {
  if (!explicitOptIn || !inBrowser() || !isVisitorLedgerClientEnabled() ||
      !visitorConsentAllowed(localStorage.getItem(EUT_COOKIE_KEY))) return false;
  const token = currentVisitorToken(false);
  if (!token) return false;
  try {
    const { data, error } = await db.rpc("eut_link_my_optin_visit", {
      _visitor_token: token, _consent_version: EUT_VISITOR_CONSENT_VERSION,
    });
    return !error && data?.ok === true;
  } catch { return false; }
}

/** Revocation permits no more optional page events until fresh consent. */
export function forgetVisitorToken() {
  seenGroups.clear();
  if (!inBrowser()) return;
  try { sessionStorage.removeItem(VISITOR_SESSION_KEY); } catch { /* ignore */ }
}
