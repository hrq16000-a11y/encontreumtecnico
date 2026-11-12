import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AdminModule } from "@/lib/admin-sections";
import { adminCount, clientCounters, advertisingCounters } from "@/lib/admin-command-metrics";

const db = supabase as unknown as SupabaseClient;
type Metrics = {
  approved: number | null; pending: number | null;
  requests: number | null; requestsOpen: number | null;
  clients: number | null; unconfirmed: number | null;
  sponsors: number | null; campaigns: number | null; drafts: number | null;
};
type SummaryItem = { label: string; value: number | null; module: AdminModule; note?: string };

/** Exact, metadata-only reads: the overview never fetches request texts or contacts. */
async function count(table: "technicians" | "service_requests", status?: string): Promise<number | null> {
  try {
    const query = db.from(table).select("id", { count: "exact", head: true });
    const result = status === undefined ? await query : await query.eq("status", status);
    return result.error ? null : adminCount(result.count);
  } catch { return null; }
}
async function dashboard(): Promise<Metrics> {
  const [approved, pending, requests, requestsOpen, clientsRaw, adsRaw] = await Promise.all([
    count("technicians", "aprovado"),
    count("technicians", "pendente"),
    count("service_requests"),
    count("service_requests", "aberta"),
    db.rpc("eut_admin_client_insights", { _audit_filter: "todos", _page: 0, _subject_user_id: null })
      .then(({ data, error }) => error ? null : data).catch(() => null),
    db.rpc("eut_ads_admin_snapshot")
      .then(({ data, error }) => error ? null : data).catch(() => null),
  ]);
  return { approved, pending, requests, requestsOpen,
    ...clientCounters(clientsRaw), ...advertisingCounters(adsRaw) };
}

export function AdminCommandOverview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMetrics(null);
    void dashboard().then((value) => { if (active) setMetrics(value); })
      .catch(() => { if (active) setMetrics(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const cards: SummaryItem[] = [
    { label: "Técnicos aprovados", value: metrics?.approved ?? null, module: "tecnicos", note: "Cadastros atuais" },
    { label: "Clientes cadastrados", value: metrics?.clients ?? null, module: "clientes", note: "Total do RPC administrativo" },
    { label: "Solicitações registradas", value: metrics?.requests ?? null, module: "solicitacoes", note: "Todas as situações" },
    { label: "Solicitações abertas", value: metrics?.requestsOpen ?? null, module: "solicitacoes", note: "Status: aberta" },
    { label: "Patrocinadores", value: metrics?.sponsors ?? null, module: "patrocinadores", note: "Registros comerciais" },
    { label: "Campanhas", value: metrics?.campaigns ?? null, module: "patrocinadores", note: "Registros comerciais" },
  ];
  const alerts: SummaryItem[] = [
    { label: "Revisar técnicos pendentes", value: metrics?.pending ?? null, module: "tecnicos" },
    { label: "Acompanhar solicitações abertas", value: metrics?.requestsOpen ?? null, module: "solicitacoes" },
    { label: "Conferir clientes sem confirmação", value: metrics?.unconfirmed ?? null, module: "clientes" },
    { label: "Revisar campanhas em rascunho", value: metrics?.drafts ?? null, module: "patrocinadores" },
  ];
  const availableAlerts = alerts.filter((item) => item.value !== null && item.value > 0);
  const incomplete = !loading && [...cards, ...alerts].some((item) => item.value === null);

  return <section className="mt-6 space-y-5" aria-label="Central de comando operacional">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-foreground">Operação em tempo real</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contagens exatas e RPCs administrativas existentes. Sem leitura de descrições, telefones ou e-mails neste resumo.
        </p>
      </div>
      <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold disabled:opacity-50">
        Atualizar indicadores
      </button>
    </div>
    {incomplete && <p role="status" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
      Alguns indicadores estão indisponíveis. Falhas de consulta nunca são exibidas como zero.
    </p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((item) => <Link key={item.label} to="/admin/$secao" params={{ secao: item.module }}
        className="block min-w-0 rounded-xl border border-border bg-background p-4 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block text-sm font-semibold text-muted-foreground">{item.label}</span>
        <strong aria-live="polite" className="mt-1 block text-2xl font-bold tabular-nums text-foreground">
          {loading ? "…" : item.value === null ? "Indisponível" : item.value.toLocaleString("pt-BR")}
        </strong>
        <span className="mt-2 block text-xs text-muted-foreground">{item.note} · Abrir módulo</span>
      </Link>)}
    </div>
    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
      <h3 className="font-bold text-foreground">Fila de atenção</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Indicadores de acompanhamento; nenhuma ação é disparada automaticamente.
      </p>
      {loading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Consultando pendências…</p>
        : availableAlerts.length ? <ul className="mt-4 grid gap-2">
          {availableAlerts.map((item) => <li key={item.label}>
            <Link to="/admin/$secao" params={{ secao: item.module }}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span>{item.label}</span>
              <strong className="tabular-nums text-primary">{item.value?.toLocaleString("pt-BR")}</strong>
            </Link>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-muted-foreground">Nenhuma pendência nos indicadores disponíveis.</p>}
    </div>
  </section>;
}
