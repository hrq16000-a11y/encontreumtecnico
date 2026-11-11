import { useEffect, useRef, useState } from "react";
import { hasAdvertisingConsent, isAdSenseServingEnabled } from "./adsense-loader";

const CLIENT = "ca-pub-3762170279587706";
const SLOT = "5328066374";

type AdSenseWindow = Window & { adsbygoogle?: Array<Record<string, never>> };

/**
 * Google AdSense responsive "autorelaxed" unit.
 * Unlike a pasted inline script, this initializes after React has mounted the
 * <ins> element and only after the visitor opts into advertising cookies.
 */
export function AdSensePublicUnit() {
  const [permitted, setPermitted] = useState(false);
  const container = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => setPermitted(isAdSenseServingEnabled() && hasAdvertisingConsent());
    refresh();
    window.addEventListener("eut-consent-changed", refresh);
    return () => window.removeEventListener("eut-consent-changed", refresh);
  }, []);

  useEffect(() => {
    if (!permitted || !container.current) return;
    const ins = container.current.querySelector<HTMLElement>("ins.adsbygoogle");
    if (!ins || ins.dataset["eutPushed"] === "true") return;
    // React StrictMode can replay effects, but this exact DOM node must only
    // receive one push. The global loader handles the script once in <head>.
    ins.dataset["eutPushed"] = "true";
    try {
      const target = window as AdSenseWindow;
      (target.adsbygoogle = target.adsbygoogle || []).push({});
    } catch {
      // Google may decline an unapproved placement. Never block the page.
    }
  }, [permitted]);

  if (!permitted) return null;
  return (
    <section ref={container} aria-label="Publicidade Google AdSense"
      className="mx-auto w-full max-w-6xl px-4 py-6">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Publicidade
      </p>
      <ins className="adsbygoogle" style={{ display: "block" }}
        data-ad-format="autorelaxed"
        data-ad-client={CLIENT} data-ad-slot={SLOT} />
    </section>
  );
}
