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
      const next = supabase.channel(CONSENTED_VISITOR_CHANNEL);
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
    window.addEventListener("eut-consent-changed", visibility);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", detach);
    sync();
    return () => {
      window.removeEventListener("eut-consent-changed", visibility);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", detach);
      detach();
    };
  }, [pathname]);
  return null;
}
