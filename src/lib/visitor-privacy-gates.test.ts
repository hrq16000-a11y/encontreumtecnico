import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
describe("Fase 3 — consentimento não é vigilância", () => {
  it("somente classe pública pode disparar visitante sem identificadores", () => {
    const observer=read("src/components/visitor-ledger-observer.tsx");
    const analytics=read("src/lib/visitor-analytics.ts");
    const access=read("src/lib/visitor-access.functions.ts");
    expect(observer).toContain("publicPageKind(pathname)");
    expect(analytics).toContain("visitorConsentAllowed(localStorage.getItem(EUT_COOKIE_KEY))");
    expect(analytics).not.toContain("navigator.geolocation");
    expect(analytics).not.toContain("navigator.userAgent");
    expect(analytics).not.toContain("getRequestHeader");
    expect(analytics).not.toContain("location.search");
    expect(access).toContain('getRequestHeader("x-vercel-forwarded-for")');
    expect(access).toContain('process.env["EUT_SUPABASE_SERVICE_ROLE_KEY"]');
    expect(access).toContain('process.env["EUT_VISITOR_ACCESS_ENABLED"] !== "true"');
  });
  it("opt-in da nova finalidade não é herdado de analytics nem publicidade", () => {
    const notice=read("src/components/cookie-notice.tsx");
    const module=read("src/lib/visitor-consent.ts");
    expect(notice).toContain("visitorAnalytics");
    expect(notice).toContain("makeCookieChoice(c)");
    expect(notice).toContain('writeVisitorOptInEvent("consent_revoked")');
    expect(module).toContain('parsed["version"] === EUT_VISITOR_CONSENT_VERSION');
    expect(module).toContain('parsed["visitorAnalytics"] === true');
    expect(notice).not.toContain("getCurrentPosition");
  });
});
