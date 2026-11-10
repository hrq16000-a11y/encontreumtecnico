import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
// A public online signal expires after three minutes server-side.
// Two-minute heartbeats reduce API use, and run only while this tab is visible.
const HEARTBEAT_MS = 120_000;

/** Optional, owner-controlled online activity, not certification or a guarantee of response. */
export function TechnicianPresence({ userId }: { userId: string }) {
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const optedIn = useRef(false);

  useEffect(() => {
    let mounted = true;
    optedIn.current = false;
    setOnline(false);
    setLoading(true);
    void Promise.resolve(db.rpc("eut_my_presence_is_online")).then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setMessage("Não foi possível consultar sua presença. Tente novamente.");
      } else {
        setOnline(data === true);
        optedIn.current = data === true;
      }
      setLoading(false);
    }).catch(() => {
      if (mounted) {
        setMessage("A consulta de presença está indisponível.");
        setLoading(false);
      }
    });
    return () => { mounted = false; optedIn.current = false; };
  }, [userId]);

  useEffect(() => {
    if (!online) return;
    let mounted = true;
    let sending = false;
    const heartbeat = async () => {
      if (!mounted || !optedIn.current || document.visibilityState !== "visible" || sending) return;
      sending = true;
      try {
        const { error } = await db.rpc("eut_set_my_presence", { _available: true });
        if (error && mounted) {
          optedIn.current = false;
          setOnline(false);
          setMessage("A sessão online não pôde ser renovada. Ative novamente.");
        }
      } catch {
        if (mounted) {
          optedIn.current = false;
          setOnline(false);
          setMessage("A conexão foi interrompida. Ative novamente o status online.");
        }
      } finally {
        sending = false;
      }
    };
    // The initial activation already recorded a heartbeat. Refresh on tab return,
    // and only while the user is still actively viewing the panel.
    const onVisibility = () => { if (document.visibilityState === "visible") void heartbeat(); };
    const interval = window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [online, userId]);

  async function togglePresence() {
    if (busy || loading) return;
    const next = !online;
    setBusy(true);
    setMessage(null);
    try {
      if (next && document.visibilityState !== "visible") {
        setMessage("Abra o painel em primeiro plano para ficar online.");
        return;
      }
      // Turning off stops the timer before the server write.
      if (!next) optedIn.current = false;
      const { data, error } = await db.rpc("eut_set_my_presence", { _available: next });
      if (error || data !== (next ? "online" : "offline")) {
        setMessage("Não foi possível alterar sua presença. Tente novamente.");
        return;
      }
      optedIn.current = next;
      setOnline(next);
    } catch {
      setMessage("Falha de conexão ao atualizar a presença. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-5" aria-label="Minha disponibilidade online">
      <h2 className="text-base font-semibold text-card-foreground">Disponibilidade no aplicativo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ative quando estiver utilizando o painel e puder receber solicitações. A presença
        é um sinal de atividade, não uma garantia de resposta ou uma avaliação profissional.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground" role="status">
          {loading ? "Consultando presença…" : online ? "Online neste painel" : "Offline"}
        </span>
        <button type="button" onClick={() => void togglePresence()} disabled={busy || loading}
          aria-pressed={online}
          className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Atualizando…" : online ? "Ficar offline" : "Ficar online"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Atualizamos o sinal a cada dois minutos com o painel visível. Se sair ou perder
        conexão, a indicação pública expira automaticamente após três minutos sem atividade.
        Seu telefone continua privado.
      </p>
      {message && <p className="mt-3 text-sm text-foreground" role="alert">{message}</p>}
    </section>
  );
}
