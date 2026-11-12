import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// Account verification via meta/ads.txt is independent of serving.
// Public placements only load after explicit advertising consent.
// A production build flag can disable ad loading if needed.
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

export function isAdSenseServingEnabled(): boolean {
  // Requested placements are enabled only on public routes after consent.
  // Set VITE_EUT_ADSENSE_SERVING=false and redeploy to disable.
  return import.meta.env["VITE_EUT_ADSENSE_SERVING"] !== "false";
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
