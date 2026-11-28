import { useEffect } from "react";
import { publicPageKind, isVisitorAccessClientEnabled } from "@/lib/visitor-consent";
import { recordConsentedPageGroup } from "@/lib/visitor-analytics";
import { recordMinimalApplicationAccess } from "@/lib/visitor-access.functions";

/** Only coarse public page classes; no query strings, cookies, exact paths or contacts. */
export function VisitorLedgerObserver({ pathname }: { pathname: string }) {
  useEffect(() => {
    if (!publicPageKind(pathname)) return;
    if (isVisitorAccessClientEnabled()) void recordMinimalApplicationAccess().catch(() => undefined);
    const check = () => { void recordConsentedPageGroup(pathname); };
    check();
    window.addEventListener("eut-consent-changed", check);
    return () => window.removeEventListener("eut-consent-changed", check);
  }, [pathname]);
  return null;
}
