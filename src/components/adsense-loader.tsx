import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

// Account verification via meta/ads.txt is independent of serving.
// Public placements only load after explicit advertising consent.
// A production build flag can disable ad loading if needed.
const CLIENT = "ca-pub-3762170279587706";
export const ADSENSE_DISPLAY_SLOT = "9606076941";
const SCRIPT_URL = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT;
const CONSENT_KEY = "eut-cookie-consent";
const PUBLIC_ROUTES = new Set(["/", "/tecnicos", "/servicos", "/como-funciona", "/faq", "/galeria"]);

export function isEligibleAdSenseRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

export function allowsAdSenseAdvertising(consent: unknown): boolean {
  return !!consent && typeof consent === "object" &&
    (consent as { advertising?: unknown }).advertising === true;
}

export function isAdSenseServingEnabled(): boolean {
  // Requested placements are enabled only on public routes after consent.
  // Set VITE_EUT_ADSENSE_SERVING=false and redeploy to disable.
  return import.meta.env["VITE_EUT_ADSENSE_SERVING"] !== "false";
}

/** Independent rollout flag: the existing home unit keeps its current behavior. */
export function isAdSenseDisplayEnabled(): boolean {
  return import.meta.env["VITE_EUT_ADSENSE_DISPLAY_9606076941"] === "true";
}

export function hasAdvertisingConsent(): boolean {
  try {
    return allowsAdSenseAdvertising(JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null"));
  } catch { return false; }
}

/** One script per page after opt-in, never on private screens. */
export function AdSenseLoader() {
  const pathname = useRouterState({ select: state => state.location.pathname });

  useEffect(() => {
    if (!isAdSenseServingEnabled()) return;
    const sync = () => {
      const permitted = isEligibleAdSenseRoute(pathname) && hasAdvertisingConsent();
      const existing = document.head.querySelector<HTMLScriptElement>('script[data-eut-adsense="true"]');
      if (!permitted) {
        existing?.remove();
        return;
      }
      if (existing) return;
      // Never inject a second publisher script if an existing integration owns it.
      if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return;
      const script = document.createElement("script");
      script.async = true;
      script.src = SCRIPT_URL;
      script.crossOrigin = "anonymous";
      script.dataset["eutAdsense"] = "true";
      document.head.appendChild(script);
    };
    sync();
    window.addEventListener("eut-consent-changed", sync);
    return () => window.removeEventListener("eut-consent-changed", sync);
  }, [pathname]);
  return null;
}


/** Optional display placement. Requires its own explicit flag in addition to
 * the existing consent and publisher serving settings. Never replaces the
 * already published home unit (slot 5328066374). */
function DisplayAd({ path }: { path: string }) {
  const adRef = useRef<HTMLModElement>(null);
  useEffect(() => {
    const ad = adRef.current;
    if (!ad || ad.dataset["eutAdRequested"] === "true" ||
      ad.hasAttribute("data-adsbygoogle-status")) return;
    ad.dataset["eutAdRequested"] = "true";
    try {
      const ads = window as Window & { adsbygoogle?: Array<Record<string, never>> };
      (ads.adsbygoogle = ads.adsbygoogle || []).push({});
    } catch { /* Never disrupt the page when the provider rejects a request. */ }
  }, []);
  return (
    <section aria-label="Publicidade" data-eut-adsense-slot={ADSENSE_DISPLAY_SLOT}
      data-eut-public-route={path}
      className="mx-auto w-full max-w-6xl min-w-0 px-4 py-5 sm:px-6">
      <p className="mb-2 text-right text-[11px] text-muted-foreground">Publicidade</p>
      <ins ref={adRef} className="adsbygoogle" style={{ display: "block" }}
        data-ad-client={CLIENT} data-ad-slot={ADSENSE_DISPLAY_SLOT}
        data-ad-format="auto" data-full-width-responsive="true" />
    </section>
  );
}

/** Additional slot defaults to OFF, even when legacy publisher serving is ON. */
export function AdSenseDisplaySlot() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(
      isAdSenseDisplayEnabled() && isAdSenseServingEnabled() &&
      isEligibleAdSenseRoute(pathname) && hasAdvertisingConsent()
    );
    sync();
    window.addEventListener("eut-consent-changed", sync);
    return () => window.removeEventListener("eut-consent-changed", sync);
  }, [pathname]);
  if (!allowed || !isEligibleAdSenseRoute(pathname)) return null;
  return <DisplayAd key={pathname} path={pathname} />;
}
