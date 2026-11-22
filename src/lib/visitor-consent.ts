/** Visitor tracking is separate from existing search-analytics/ad consent.
 * Older cookie choices never silently enable the new personal-data purpose.
 */
export const EUT_COOKIE_KEY = "eut-cookie-consent";
export const EUT_VISITOR_CONSENT_VERSION = "2026-11-22.1";
export const EUT_TERMS_VERSION = "2026-11-22";
export const EUT_PRIVACY_VERSION = "2026-11-22";

export type CookieChoice = {
  necessary: true;
  functional: boolean; analytics: boolean; advertising: boolean; presence: boolean;
  visitorAnalytics: boolean;
  version: string;
  decidedAt: string;
};

export function visitorConsentAllowed(raw: string | null): boolean {
  try {
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed.version === EUT_VISITOR_CONSENT_VERSION && parsed.visitorAnalytics === true;
  } catch { return false; }
}

export function makeCookieChoice(
  choices: Pick<CookieChoice, "functional" | "analytics" | "advertising" | "presence" | "visitorAnalytics">,
  now = new Date(),
): CookieChoice {
  return { necessary: true, ...choices,
    version: EUT_VISITOR_CONSENT_VERSION, decidedAt: now.toISOString() };
}

/** Never store URL queries, identifiers, email, IP, precise location, or workspace paths. */
export type PublicPageKind = "home" | "directory" | "services" | "guides" | null;
export function publicPageKind(pathname: string): PublicPageKind {
  if (pathname === "/") return "home";
  if (pathname === "/tecnicos") return "directory";
  if (pathname === "/servicos" || /^\/servicos\/[a-z0-9-]{1,70}$/.test(pathname)) return "services";
  if (pathname === "/guias") return "guides";
  return null;
}

export type VisitorToken = { token: string; issuedAt: number };
export const VISITOR_SESSION_KEY = "eut-visit-rotating-v1";
export const VISITOR_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export function parseVisitorToken(raw: string | null, now = Date.now()): VisitorToken | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<VisitorToken>;
    if (typeof data.token !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(data.token) ||
      typeof data.issuedAt !== "number" || !Number.isFinite(data.issuedAt) ||
      now < data.issuedAt || now - data.issuedAt >= VISITOR_TOKEN_TTL_MS) return null;
    return { token: data.token, issuedAt: data.issuedAt };
  } catch { return null; }
}

export function isVisitorLedgerClientEnabled(): boolean {
  return import.meta.env["VITE_EUT_VISITOR_ANALYTICS_ENABLED"] === "true";
}

export function isVisitorAccessClientEnabled(): boolean {
  return import.meta.env["VITE_EUT_VISITOR_ACCESS_ENABLED"] === "true";
}
