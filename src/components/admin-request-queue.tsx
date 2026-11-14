import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { REQUEST_STATUS, type Req } from "@/components/request-list";
import { cleanAdminQuery } from "@/lib/admin-search";

const PAGE_SIZE = 20;
const REQUEST_FILTERS = ["todas", "aberta", "aceita", "recusada", "concluida", "cancelada"] as const;
type StatusFilter = typeof REQUEST_FILTERS[number];

export function AdminRequestQueue() {
  const [draft, setDraft] = useState(() => typeof window === "undefined" ? "" :
    new URLSearchParams(window.location.search).get("q")?.slice(0, 70) ?? "");
  const [term, setTerm] = useState(cleanAdminQuery(draft));
  const [status, setStatus] = useState<StatusFilter>("todas");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Req[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(cleanAdminQuery(draft)); setPage(0); }, 280);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    let query = supabase.from("service_requests")
      .select("*", { count: "exact" });
    if (status !== "todas") query = query.eq("status", status);
    if (term) query = query.or(["title", "city", "category"]
      .map((field) => `${field}.ilike.%${term}%`).join(","));
    void Promise.resolve(query.order("created_at", { ascending: false }).order("id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1))
      .then(({ data, count, error: queryError }) => {
        if (!active) return;
        if (queryError) { setError(true); setRows([]); setTotal(null); }
        else { setRows(data ?? []); setTotal(count ?? null); }
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, term, page, revision]);

  const pages = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return <section className="mt-5 space-y-4" aria-label="Fila operacional de solicitações">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Solicitações</h2>
        <p className="mt-1 text-sm text-muted-foreground">Localize, filtre e inspecione os pedidos. Dados privados permanecem restritos a administradores.</p></div>
      <button type="button" onClick={() => setRevision((n) => n + 1)} disabled={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-40">
        <RefreshCw className="h-4 w-4" /> Atualizar
      </button>
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
      <label className="min-w-0 text-sm font-semibold">Buscar solicitações
        <span className="mt-1 flex items-center rounded-xl border border-input bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={draft} onChange={(event) => setDraft(event.target.value)}
            maxLength={70} placeholder="Título, cidade ou categoria" className="min-h-12 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
        </span>
      </label>
      <label className="text-sm font-semibold">Situação
        <select className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
          value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(0); }}>
          {REQUEST_FILTERS.map((value) => <option value={value} key={value}>{value === "todas" ? "Todas" : REQUEST_STATUS[value]}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" role="status">
      <span>{loading ? "Carregando…" : error ? "Consulta indisponível" : total === null ? "Total indisponível" :
        `${total.toLocaleString("pt-BR")} solicitação(ões) · ${rows.length} nesta página`}</span>
      <span>Mais recentes primeiro · {page + 1}/{pages}</span>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">Não foi possível consultar as solicitações. Nenhum resultado foi considerado vazio; tente atualizar.</p>}
    {!loading && !error && rows.length === 0 && <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Nenhum pedido corresponde aos filtros.</p>}
    <ul className="grid gap-2">
      {rows.map((row) => <li key={row.id} className="min-w-0 rounded-xl border border-border bg-background p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><h3 className="break-words text-sm font-bold sm:text-base">{row.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{row.category} · {row.city}{row.region ? ` · ${row.region}` : ""} · {new Date(row.created_at).toLocaleString("pt-BR")}</p></div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{REQUEST_STATUS[row.status]}</span>
        </div>
        <button type="button" onClick={() => toggle(row.id)} aria-expanded={expanded.has(row.id)}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold">
          {expanded.has(row.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {expanded.has(row.id) ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
        {expanded.has(row.id) && <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
          <p className="whitespace-pre-line break-words">{row.description}</p>
          <p className="break-all text-xs text-muted-foreground">Protocolo: {row.id}</p>
          <button type="button" onClick={() => void navigator.clipboard.writeText(row.id)}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-xs font-semibold">Copiar protocolo</button>
        </div>}
      </li>)}
    </ul>
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Páginas das solicitações">
      <button type="button" disabled={loading || page === 0} onClick={() => setPage((n) => Math.max(0, n - 1))}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Anterior</button>
      <span className="text-sm text-muted-foreground">Página {page + 1} de {pages}</span>
      <button type="button" disabled={loading || page + 1 >= pages} onClick={() => setPage((n) => n + 1)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 text-sm disabled:opacity-40">Próxima<ChevronRight className="h-4 w-4" /></button>
    </nav>
  </section>;
}
