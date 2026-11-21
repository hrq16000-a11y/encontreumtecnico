import { useEffect } from "react";
import { canShareAnonymousPresence } from "@/lib/visitor-realtime-presence";
import { HTTP_PRESENCE_READY, newPresenceTabToken, sendPresenceLease } from "@/lib/visitor-http-presence";

/** Client adapter only. Both HTTP feature flags are OFF until separately authorized. */
export function ConsentedVisitorPresence({ pathname }: { pathname: string }) {
  useEffect(() => {
    if (!HTTP_PRESENCE_READY) return;
    let tabToken: string | null = null;
    let started = false;
    let beating = false;
    let failed = false;
    let generation = 0;

    const permitted = () => {
      try {
        return document.visibilityState === "visible" &&
          canShareAnonymousPresence(pathname, localStorage.getItem("eut-cookie-consent"));
      } catch { return false; }
    };
    const leave = () => {
      const previous = tabToken;
      tabToken = null;
      started = false;
      beating = false;
      generation++;
      if (previous) void sendPresenceLease("leave", previous, true).catch(() => undefined);
    };
    const start = async () => {
      if (tabToken || failed || !permitted()) return;
      const current = ++generation;
      const token = newPresenceTabToken();
      tabToken = token;
      try {
        const status = await sendPresenceLease("start", token);
        if (current !== generation) return; // A leave may have raced the start.
        if (!permitted() || status !== 204) {
          failed = status !== 204;
          leave();
          return;
        }
        started = true;
      } catch {
        if (current === generation) { failed = true; leave(); }
      }
    };
    const beat = async () => {
      if (!permitted()) { leave(); return; }
      if (!tabToken) { await start(); return; }
      if (!started || beating) return;
      const token = tabToken;
      beating = true;
      try {
        const status = await sendPresenceLease("beat", token);
        if (tabToken === token && status !== 204) { failed = true; leave(); }
      } catch {
        if (tabToken === token) { failed = true; leave(); }
      } finally { beating = false; }
    };
    const sync = () => {
      if (!permitted()) { failed = false; leave(); return; }
      failed = false;
      if (!tabToken) void start();
    };
    const onConsentStorage = (event: StorageEvent) => {
      if (event.key === "eut-cookie-consent" || event.key === null) sync();
    };
    const onPageHide = () => leave();

    window.addEventListener("eut-consent-changed", sync);
    window.addEventListener("storage", onConsentStorage);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", sync);
    const interval = window.setInterval(() => { void beat(); }, 25_000);
    sync();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("eut-consent-changed", sync);
      window.removeEventListener("storage", onConsentStorage);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", sync);
      leave();
    };
  }, [pathname]);
  return null;
}
