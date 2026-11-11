import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

// Verification remains available via meta tag and /ads.txt when serving is paused.
// Display units activate ONLY on allowed public routes, after explicit ad consent,
// with VITE_EUT_ADSENSE_SERVING=true and Google approval / legal review.
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

function hasAdvertisingConsent(): boolean {
  try {
    return allowsAdSenseAdvertising(JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null"));
  } catch { return false; }
}

export function isAdSenseServingEnabled(): boolean {
  return import.meta.env["VITE_EUT_ADSENSE_SERVING"] === "true";
}

function mayServeAds(pathname: string): boolean {
  return isAdSenseServingEnabled() && isEligibleAdSenseRoute(pathname) && hasAdvertisingConsent();
}

/** One shared AdSense script per eligible page, never on login/admin/private routes. */
export function AdSenseLoader() {
  const pathname = useRouterState({ select: state => state.location.pathname });

  useEffect(() => {
    if (!isAdSenseServingEnabled()) return;
    const sync = () => {
      const permitted = mayServeAds(pathname);
      const existing = document.head.querySelector<HTMLScriptElement>('script[data-eut-adsense="true"]');
      if (!permitted) {
        existing?.remove();
        return;
      }
      if (existing) return;
      // Avoid injecting another copy of the script if already supplied elsewhere.
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

function DisplayAd({ path }: { path: string }) {
  const adRef = useRef<HTMLModElement>(null);
  useEffect(() => {
    const ad = adRef.current;
    if (!ad || ad.dataset["eutAdRequested"] === "true" ||
      ad.hasAttribute("data-adsbygoogle-status")) return;

    // React strict mode runs effects twice: only one push per actual <ins>.
    ad.dataset["eutAdRequested"] = "true";
    try {
      const adWindow = window as Window & { adsbygoogle?: Array<Record<string, never>> };
      (adWindow.adsbygoogle = adWindow.adsbygoogle || []).push({});
    } catch {
      // Google may reject a unit until site review or provider availability.
      // Never break the portal or retry ads aggressively.
    }
  }, []);

  return (
    <section aria-label="Publicidade" data-eut-adsense-slot={ADSENSE_DISPLAY_SLOT}
      data-eut-public-route={path}
      className="mx-auto w-full max-w-6xl min-w-0 px-4 py-5 sm:px-6">
      <p className="mb-2 text-right text-[11px] text-muted-foreground">Publicidade</p>
      <ins ref={adRef} className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={ADSENSE_DISPLAY_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  );
}

/**
 * Responsive display unit inside <body>, below public page content.
 * One unit per eligible public route. A new page's DOM gets one push;
 * navigation to a private route or withdrawal of consent unmounts the ad.
 */
export function AdSenseDisplaySlot() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(mayServeAds(pathname));
    sync();
    window.addEventListener("eut-consent-changed", sync);
    return () => window.removeEventListener("eut-consent-changed", sync);
  }, [pathname]);

  if (!allowed || !isEligibleAdSenseRoute(pathname)) return null;
  return <DisplayAd key={pathname} path={pathname} />;
}
