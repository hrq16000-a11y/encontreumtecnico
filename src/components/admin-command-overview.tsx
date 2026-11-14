import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, ArrowUpRight, CircleCheck, Inbox, Radar, Search, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AdminModule } from "@/lib/admin-sections";
import { adminCount, clientCounters, advertisingCounters } from "@/lib/admin-command-metrics";

const db = supabase as unknown as SupabaseClient;
type Metrics = {
  approved: number | null; pending: number | null;
  wordpress: number | null;
  requests: number | null; requestsOpen: number | null;
  requestsDone: number | null; requestsCancelled: number | null;
  newMessages: number | null;
  clients: number | null; unconfirmed: number | null;
  sponsors: number | null; campaigns: number | null; drafts: number | null;
};
type SummaryItem = { label: string; value: number | null; module: AdminModule; note?: string };

/** Exact, metadata-only reads: the overview never fetches request texts or contacts. */
async function count(table: "technicians" | "service_requests" | "legacy_review_profiles", status?: string): Promise<number | null> {
  try {
    const query = db.from(table).select(table === "legacy_review_profiles" ? "wp_post_id" : "id", { count: "exact", head: true });
    const result = table === "legacy_review_profiles"
      ? await query.eq("source_key", "wordpress_20261108")
      : status === undefined ? await query : await query.eq("status", status);
    return result.error ? null : adminCount(result.count);
  } catch { return null; }
}
async function dashboard(): Promise<Metrics> {
  const [approved, pending, wordpress, requests, requestsOpen, requestsDone, requestsCancelled, newMessages, clientsRaw, adsRaw] = await Promise.all([
    count("technicians", "aprovado"),
    count("technicians", "pendente"),
    count("legacy_review_profiles"),
    count("service_requests"),
    count("service_requests", "aberta"),
    count("service_requests", "concluida"),
    count("service_requests", "cancelada"),
    Promise.resolve(db.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "nova"))
      .then(({ count: value, error }) => error ? null : adminCount(value)).catch(() => null),
    Promise.resolve(db.rpc("eut_admin_client_insights", { _audit_filter: "todos", _page: 0, _subject_user_id: null }))
      .then(({ data, error }) => error ? null : data).catch(() => null),
    Promise.resolve(db.rpc("eut_ads_admin_snapshot"))
      .then(({ data, error }) => error ? null : data).catch(() => null),
  ]);
  return { approved, pending, wordpress, requests, requestsOpen, requestsDone, requestsCancelled, newMessages,
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
    { label: "Técnicos", value: null, module: "tecnicos", note: "Lista única de gestão e edição" },
    { label: "Clientes cadastrados", value: metrics?.clients ?? null, module: "clientes", note: "Total do RPC administrativo" },
    { label: "Solicitações registradas", value: metrics?.requests ?? null, module: "solicitacoes", note: "Todas as situações" },
    { label: "Solicitações abertas", value: metrics?.requestsOpen ?? null, module: "solicitacoes", note: "Status: aberta" },
    { label: "Mensagens novas", value: metrics?.newMessages ?? null, module: "mensagens", note: "Aguardando triagem" },
    { label: "Patrocinadores", value: metrics?.sponsors ?? null, module: "patrocinadores", note: "Registros comerciais" },
    { label: "Campanhas", value: metrics?.campaigns ?? null, module: "patrocinadores", note: "Registros comerciais" },
  ];
  const alerts: SummaryItem[] = [
    { label: "Revisar técnicos pendentes", value: metrics?.pending ?? null, module: "tecnicos" },
    { label: "Acompanhar solicitações abertas", value: metrics?.requestsOpen ?? null, module: "solicitacoes" },
    { label: "Ler mensagens novas", value: metrics?.newMessages ?? null, module: "mensagens" },
    { label: "Conferir clientes sem confirmação", value: metrics?.unconfirmed ?? null, module: "clientes" },
    { label: "Revisar campanhas em rascunho", value: metrics?.drafts ?? null, module: "patrocinadores" },
  ];
  const availableAlerts = alerts.filter((item) => item.value !== null && item.value > 0);
  const incomplete = !loading && [...cards, ...alerts].some((item) => item.value === null && item.label !== "Técnicos");

  const requestStages = [
    { label: "Abertas", count: metrics?.requestsOpen ?? null, color: "bg-amber-500" },
    { label: "Concluídas", count: metrics?.requestsDone ?? null, color: "bg-emerald-500" },
    { label: "Canceladas", count: metrics?.requestsCancelled ?? null, color: "bg-slate-400" },
  ];
  const knownTotal = requestStages.every((stage) => stage.count !== null);
  const stageSum = knownTotal ? requestStages.reduce((sum, stage) => sum + (stage.count ?? 0), 0) : 0;

  return <section className="mt-6 space-y-5" aria-label="Central de comando operacional">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground"><Radar className="h-5 w-5 text-primary" /> Operação em tempo de consulta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores obtidos dos registros autorizados. Toque em um cartão para abrir a gestão correspondente.
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
        className="group block min-w-0 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="block text-sm font-semibold text-muted-foreground">{item.label}</span>
        <strong aria-live="polite" className="mt-1 block text-2xl font-bold tabular-nums text-foreground">
          {item.module === "tecnicos" ? "Abrir gestão" : loading ? "…" : item.value === null ? "Indisponível" : item.value.toLocaleString("pt-BR")}
        </strong>
        <span className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">{item.note} <ArrowUpRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" /></span>
      </Link>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-bold text-foreground"><Inbox className="h-4 w-4 text-primary" /> Fila de atenção</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Indicadores de acompanhamento; nenhuma ação é disparada automaticamente.
      </p>
      {loading ? <p role="status" className="mt-3 text-sm text-muted-foreground">Consultando pendências…</p>
        : availableAlerts.length ? <ul className="mt-4 grid gap-2">
          {availableAlerts.map((item) => <li key={item.label}>
            <Link to="/admin/$secao" params={{ secao: item.module }}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span>{item.label}</span>
              <span className="flex items-center gap-2"><strong className="tabular-nums text-primary">{item.value?.toLocaleString("pt-BR")}</strong><ArrowUpRight className="h-4 w-4 text-primary" /></span>
            </Link>
          </li>)}
        </ul> : <p className="mt-3 text-sm text-muted-foreground">Nenhuma pendência nos indicadores disponíveis.</p>}
    </div>
    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-bold text-foreground"><Activity className="h-4 w-4 text-primary" /> Fluxo das solicitações</h3>
      <p className="mt-1 text-xs text-muted-foreground">Distribuição por situação, sem contar respostas indisponíveis como zero.</p>
      <div className="mt-4 space-y-4">
        {requestStages.map((stage) => <div key={stage.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span>{stage.label}</span>
            <strong className="tabular-nums">{loading ? "…" : stage.count === null ? "Indisponível" : stage.count.toLocaleString("pt-BR")}</strong></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {knownTotal && <div className={`h-full rounded-full ${stage.color}`}
              style={{ width: `${stageSum ? (100 * (stage.count ?? 0)) / stageSum : 0}%` }} />}
          </div>
        </div>)}
      </div>
      <Link to="/admin/$secao" params={{ secao: "solicitacoes" }}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
        <CircleCheck className="h-4 w-4" /> Operar fila de solicitações
      </Link>
    </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-3" aria-label="Ações rápidas da operação">
      <button type="button" onClick={() => document.getElementById("admin-global-search")?.click()}
        className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold hover:border-primary">
        <Search className="h-4 w-4 text-primary" /> Buscar um registro</button>
      <Link to="/admin/$secao" params={{ secao: "tecnicos" }} className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold hover:border-primary">
        <UsersRound className="h-4 w-4 text-primary" /> Gerenciar técnicos</Link>
      <Link to="/admin/$secao" params={{ secao: "mensagens" }} className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold hover:border-primary">
        <Inbox className="h-4 w-4 text-primary" /> Tratar mensagens</Link>
    </div>
    <Link to="/admin/$secao" params={{ secao: "metricas" }}
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/25 px-4 py-2 text-sm font-semibold text-primary hover:border-primary">
      <Activity className="h-4 w-4" /> Consultar buscas recentes com consentimento <ArrowUpRight className="h-4 w-4" />
    </Link>
  </section>;
}
