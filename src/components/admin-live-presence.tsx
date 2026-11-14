import { useEffect, useState } from "react";
import { RadioTower } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CONSENTED_VISITOR_CHANNEL, countConsentedVisitorTabs } from "@/lib/visitor-realtime-presence";

/** Read-only admin observer. It does not publish presence or query identities. */
export function AdminLivePresence() {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "unavailable">("connecting");

  useEffect(() => {
    let active = true;
    const channel = supabase.channel(CONSENTED_VISITOR_CHANNEL);
    channel.on("presence", { event: "sync" }, () => {
      if (!active) return;
      setCount(countConsentedVisitorTabs(channel.presenceState()));
      setStatus("connected");
    });
    channel.subscribe((state) => {
      if (!active) return;
      if (state === "SUBSCRIBED") {
        setStatus("connected");
        setCount(countConsentedVisitorTabs(channel.presenceState()));
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        setStatus("unavailable");
        setCount(null);
      }
    });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  return <section aria-label="Presença consentida em tempo real" className="mt-7 rounded-xl border border-border bg-card p-4 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold"><RadioTower className="h-5 w-5 text-primary" /> Abas com presença consentida agora</h2>
    <div className="mt-4 flex flex-wrap items-end gap-4">
      <strong className="text-4xl font-extrabold tabular-nums" aria-live="polite">{count === null ? "—" : count.toLocaleString("pt-BR")}</strong>
      <span className="pb-1 text-sm text-muted-foreground" role="status">{status === "connected" ? "Conectado ao canal em tempo real" : status === "connecting" ? "Conectando…" : "Presença indisponível"}</span>
    </div>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">
      Contagem aproximada de abas ativas que aceitaram a opção Presença online e estão conectadas ao canal. Não identifica pessoas,
      IPs, dispositivos ou páginas visitadas; abas sem consentimento não aparecem. Não é um total de visitantes únicos,
      pode sofrer atrasos de conexão e não substitui a auditoria de contas autenticadas.
    </p>
  </section>;
}
