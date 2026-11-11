import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// Public verification uses the meta tag and ads.txt even while ad serving is paused.
// Never turn on ad serving before the Google review and privacy gates are complete.
const CLIENT = "ca-pub-3762170279587706";
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

/**
 * Google account verification is available via root meta and /ads.txt.
 * The ad runtime is opt-in and separately disabled by default. Changing the
 * VITE_EUT_ADSENSE_SERVING flag needs review of Google's approval, CSP,
 * consent behavior and Auto Ads route exclusions before production release.
 */
export function AdSenseLoader() {
  const pathname = useRouterState({ select: state => state.location.pathname });

  useEffect(() => {
    if (import.meta.env.VITE_EUT_ADSENSE_SERVING !== "true") return;
    const sync = () => {
      const permitted = isEligibleAdSenseRoute(pathname) && hasAdvertisingConsent();
      const existing = document.head.querySelector<HTMLScriptElement>('script[data-eut-adsense="true"]');
      if (!permitted) {
        existing?.remove();
        return;
      }
      if (existing) return;
      const script = document.createElement("script");
      script.async = true;
      script.src = SCRIPT_URL;
      script.crossOrigin = "anonymous";
      script.dataset.eutAdsense = "true";
      document.head.appendChild(script);
    };
    sync();
    window.addEventListener("eut-consent-changed", sync);
    return () => window.removeEventListener("eut-consent-changed", sync);
  }, [pathname]);
  return null;
}
