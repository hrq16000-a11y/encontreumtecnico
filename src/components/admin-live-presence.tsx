import { useEffect, useState } from "react";
import { RadioTower } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CONSENTED_VISITOR_CHANNEL,
  PRIVATE_VISITOR_PRESENCE_ENABLED,
  countConsentedVisitorTabs,
} from "@/lib/visitor-realtime-presence";

/**
 * The RLS policy on realtime.messages must grant SELECT only to the admin role.
 * This UI gate is never an authorization boundary. A missing policy fails closed.
 */
export function AdminLivePresence() {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "unavailable">("connecting");

  useEffect(() => {
    if (!PRIVATE_VISITOR_PRESENCE_ENABLED) return;
    let active = true;
    const channel = supabase.channel(CONSENTED_VISITOR_CHANNEL, { config: { private: true } });
    channel.on("presence", { event: "sync" }, () => {
      if (active) setCount(countConsentedVisitorTabs(channel.presenceState()));
    });
    channel.subscribe((nextStatus) => {
      if (!active) return;
      if (nextStatus === "SUBSCRIBED") {
        setCount(countConsentedVisitorTabs(channel.presenceState()));
        setStatus("connected");
      } else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT" || nextStatus === "CLOSED") {
        setCount(null);
        setStatus("unavailable");
      }
    });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return <section aria-label="Presença consentida em tempo real" className="mt-7 rounded-xl border border-border bg-card p-4 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold">
      <RadioTower className="h-5 w-5 text-primary" /> Presença online
    </h2>
    {PRIVATE_VISITOR_PRESENCE_ENABLED && status === "connected" && count !== null ? (
      <p className="mt-4 text-sm leading-6 text-muted-foreground" role="status">
        <strong className="text-3xl font-bold tabular-nums text-foreground">{count.toLocaleString("pt-BR")}</strong>
        <span className="ml-2">aba(s) visível(is) com consentimento; não são pessoas únicas.</span>
      </p>
    ) : (
      <p className="mt-4 text-sm leading-6 text-muted-foreground" role="status">
        {PRIVATE_VISITOR_PRESENCE_ENABLED && status === "connecting"
          ? "Conectando ao canal privado de presença…"
          : PRIVATE_VISITOR_PRESENCE_ENABLED
            ? "Presença indisponível: a autorização administrativa privada não foi confirmada pelo servidor."
            : "Contagem ao vivo temporariamente suspensa: a leitura de presença depende de um canal privado com autorização administrativa comprovada no servidor."}
      </p>
    )}
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      As métricas de buscas consentidas abaixo permanecem disponíveis conforme as permissões do painel.
    </p>
  </section>;
}
