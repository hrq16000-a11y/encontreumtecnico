import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canShareAnonymousPresence, CONSENTED_VISITOR_CHANNEL, CONSENTED_VISITOR_KIND } from "@/lib/visitor-realtime-presence";

/** Publishes one anonymous, temporary tab presence only with its own explicit consent. */
export function ConsentedVisitorPresence({ pathname }: { pathname: string }) {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closing = false;
    let connected = false;

    const permitted = () => {
      try {
        return document.visibilityState === "visible" &&
          canShareAnonymousPresence(pathname, localStorage.getItem("eut-cookie-consent"));
      } catch { return false; }
    };
    const detach = () => {
      closing = true;
      connected = false;
      if (channel) {
        const previous = channel;
        channel = null;
        void previous.untrack().catch(() => undefined);
        void supabase.removeChannel(previous);
      }
    };
    const sync = () => {
      if (!permitted()) {
        if (channel) detach();
        return;
      }
      if (channel) {
        if (connected) void channel.track({ kind: CONSENTED_VISITOR_KIND }).catch(() => undefined);
        return;
      }
      closing = false;
      // Authorization is enforced by realtime.messages, not by client UI.
      const next = supabase.channel(CONSENTED_VISITOR_CHANNEL, { config: { private: true } });
      channel = next;
      next.subscribe((status) => {
        if (closing || channel !== next) return;
        if (status === "SUBSCRIBED") {
          connected = true;
          if (permitted()) void next.track({ kind: CONSENTED_VISITOR_KIND }).catch(() => undefined);
        }
      });
    };

    const visibility = () => sync();
    // localStorage changes in other tabs do not emit eut-consent-changed here.
    const onConsentStorage = (event: StorageEvent) => {
      if (event.key === "eut-cookie-consent" || event.key === null) sync();
    };
    window.addEventListener("eut-consent-changed", visibility);
    window.addEventListener("storage", onConsentStorage);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", detach);
    // BFCache restores the mounted page without rerunning this effect.
    window.addEventListener("pageshow", visibility);
    sync();
    return () => {
      window.removeEventListener("eut-consent-changed", visibility);
      window.removeEventListener("storage", onConsentStorage);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", detach);
      window.removeEventListener("pageshow", visibility);
      detach();
    };
  }, [pathname]);
  return null;
}
