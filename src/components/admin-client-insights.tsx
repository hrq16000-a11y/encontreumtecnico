import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AuditFilter = "todos" | "contas" | "convites" | "bloqueios";
type AuditEntry = {
  id: number;
  created_at: string;
  kind: Exclude<AuditFilter, "todos">;
  action: string;
  subject_user_id: string | null;
  reason: string;
};
type ClientOverview = {
  clients_total: number;
  clients_confirmed: number;
  clients_unconfirmed: number;
  clients_restricted: number;
  pending_client_invites: number;
  audit_total: number;
  audit_page: number;
  audit_page_size: number;
  audit: AuditEntry[];
};
const db = supabase as unknown as SupabaseClient;
const FILTERS: { value: AuditFilter; label: string }[] = [
  { value: "todos", label: "Todas as ações" },
  { value: "contas", label: "Alterações de contas" },
  { value: "convites", label: "Convites de clientes" },
  { value: "bloqueios", label: "Moderação e bloqueios" },
];

export function AdminClientInsights() {
  const [filter, setFilter] = useState<AuditFilter>("todos");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<ClientOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    void (async () => {
      try {
        const { data, error: rpcError } = await db.rpc("eut_admin_client_insights", {
          _audit_filter: filter, _page: page, _subject_user_id: null,
        });
        if (!active) return;
        if (rpcError || !data || !Array.isArray(data.audit) ||
            !Number.isInteger(data.clients_total) ||
            !Number.isInteger(data.audit_total) || data.audit_page !== page) {
          throw new Error("Resposta administrativa inválida");
        }
        setSnapshot(data as ClientOverview);
      } catch {
        if (active) setError("Não foi possível confirmar os indicadores e o histórico. Tente atualizar.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filter, page, version]);

  const totals = snapshot ? [
    { label: "Clientes cadastrados", value: snapshot.clients_total },
    { label: "E-mails confirmados", value: snapshot.clients_confirmed },
    { label: "Aguardando confirmação", value: snapshot.clients_unconfirmed },
    { label: "Contas restritas", value: snapshot.clients_restricted },
    { label: "Convites ativos para clientes", value: snapshot.pending_client_invites },
  ] : [];
  const pageSize = snapshot?.audit_page_size ?? 20;
  const pages = snapshot ? Math.max(1, Math.ceil(snapshot.audit_total / pageSize)) : 1;

  return <section aria-label="Indicadores e histórico auditado de clientes"
    className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">Indicadores reais de clientes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contagens completas calculadas no banco; não são estimativas da página atual.
          Nenhum e-mail, telefone ou atendimento privado é carregado neste resumo.
        </p>
      </div>
      <button type="button" className="min-h-11 rounded-lg border border-input px-4 text-sm"
        onClick={() => setVersion((v) => v + 1)}>Atualizar</button>
    </div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Consultando indicadores…</p>}
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {snapshot && <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {totals.map((item) => <div key={item.label} className="rounded-xl border border-border p-3">
        <dt className="text-xs text-muted-foreground">{item.label}</dt>
        <dd className="mt-1 text-2xl font-bold text-foreground tabular-nums">{item.value.toLocaleString("pt-BR")}</dd>
      </div>)}
    </dl>}
    <div className="border-t border-border pt-4">
      <h3 className="flex items-center gap-2 font-bold text-foreground">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
        Histórico administrativo de clientes
      </h3>
      <label className="mt-3 grid max-w-xs gap-1 text-sm font-semibold text-foreground">
        Tipo de evento
        <select value={filter} onChange={(event) => { setFilter(event.target.value as AuditFilter); setPage(0); }}
          className="min-h-11 rounded-lg border border-input bg-background px-3">
          {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {snapshot && <>
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {snapshot.audit_total.toLocaleString("pt-BR")} evento(s) · página {page + 1} de {pages}
        </p>
        {snapshot.audit.length === 0
          ? <p className="mt-3 text-sm text-muted-foreground">Nenhum evento neste filtro.</p>
          : <ol className="mt-3 grid gap-2">
              {snapshot.audit.map((entry) =>
                <li key={entry.kind + ":" + entry.id}
                  className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="break-all text-foreground">{entry.action}</strong>
                    <time className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("pt-BR")}
                    </time>
                  </div>
                  {entry.reason && <p className="mt-1 break-words text-muted-foreground">{entry.reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.kind === "convites" ? "Convite" :
                      entry.kind === "bloqueios" ? "Moderação" : "Conta"}
                    {entry.subject_user_id ? " · cliente " + entry.subject_user_id.slice(0, 8) + "…" : ""}
                  </p>
                </li>)}
            </ol>}
        <nav aria-label="Paginação do histórico de clientes" className="mt-4 flex flex-wrap justify-between gap-3">
          <button type="button" disabled={loading || page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">
            Anterior
          </button>
          <button type="button" disabled={loading || page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">
            Próximo
          </button>
        </nav>
      </>}
    </div>
    <p className="text-xs text-muted-foreground">
      Consulta exclusiva para administradores autenticados; histórico paginado e registros de auditoria preservados.
    </p>
  </section>;
}
