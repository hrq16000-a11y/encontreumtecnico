import { useEffect, useState } from "react";
import { RadioTower } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  HTTP_PRESENCE_READY,
  readAdminPresenceCount,
} from "@/lib/visitor-http-presence";

/**
 * The server must validate a current admin role before querying privileged leases.
 * This display and its disabled-by-default flag are never authorization boundaries.
 */
export function AdminLivePresence() {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "unavailable">("connecting");

  useEffect(() => {
    if (!HTTP_PRESENCE_READY) return;
    let active = true;
    let inFlight = false;
    const load = async () => {
      if (document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.access_token) throw new Error("No admin session");
        const next = await readAdminPresenceCount(data.session.access_token);
        if (active) { setCount(next); setStatus("connected"); }
      } catch {
        if (active) { setCount(null); setStatus("unavailable"); }
      } finally {
        inFlight = false;
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  return <section aria-label="Presença consentida em tempo real" className="mt-7 rounded-xl border border-border bg-card p-4 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold">
      <RadioTower className="h-5 w-5 text-primary" /> Presença online
    </h2>
    {HTTP_PRESENCE_READY && status === "connected" && count !== null ? (
      <p className="mt-4 text-sm leading-6 text-muted-foreground" role="status">
        <strong className="text-3xl font-bold tabular-nums text-foreground">{count.toLocaleString("pt-BR")}</strong>
        <span className="ml-2">aba(s) visível(is) com consentimento; não são pessoas únicas.</span>
      </p>
    ) : (
      <p className="mt-4 text-sm leading-6 text-muted-foreground" role="status">
        {HTTP_PRESENCE_READY && status === "connecting"
          ? "Consultando a contagem administrativa de presença…"
          : HTTP_PRESENCE_READY
            ? "Presença indisponível: o servidor não confirmou a leitura administrativa."
            : "Contagem ao vivo temporariamente suspensa: a ingestão e a leitura HTTP privadas ainda não foram autorizadas."}
      </p>
    )}
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      As métricas de buscas consentidas abaixo permanecem disponíveis conforme as permissões do painel.
    </p>
  </section>;
}
