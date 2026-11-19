import { useEffect, useState } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, RefreshCcw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAdminContactAction } from "@/lib/admin-contact-controls";
import type { Tables } from "@/integrations/supabase/types";
import { cleanAdminQuery, clearAdminFocusedRecordQuery } from "@/lib/admin-search";

const db = supabase as unknown as SupabaseClient;
type Message = Tables<"contact_messages">;
type Filter = "todas" | "nova" | "respondida" | "arquivada";
const PAGE_SIZE = 20;

export function AdminMessageQueue() {
  const [draft, setDraft] = useState(() => typeof window === "undefined" ? "" :
    (new URLSearchParams(window.location.search).get("busca") ??
      new URLSearchParams(window.location.search).get("q") ?? "").slice(0, 70));
  const [focusedId, setFocusedId] = useState(() => {
    if (typeof window === "undefined") return null;
    const id = new URLSearchParams(window.location.search).get("registro");
    return id && /^[a-f0-9-]{36}$/i.test(id) ? id : null;
  });
  const [term, setTerm] = useState(cleanAdminQuery(draft));
  const [filter, setFilter] = useState<Filter>("todas");
  const [rows, setRows] = useState<Message[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [pending, setPending] = useState<{ id: string; status: "respondida" | "arquivada" | "nova" } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(cleanAdminQuery(draft)); setPage(0); }, 280);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    let query = supabase.from("contact_messages").select("*", { count: "exact" });
    if (focusedId) query = query.eq("id", focusedId);
    else {
      if (filter !== "todas") query = query.eq("status", filter);
      if (term) query = query.or(["name", "subject"].map((field) => `${field}.ilike.%${term}%`).join(","));
    }
    void Promise.resolve(query.order("created_at", { ascending: false }).order("id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1))
      .then(({ data, count, error: queryError }) => {
        if (!active) return;
        if (queryError) { setError("Não foi possível consultar mensagens."); setRows([]); setTotal(null); }
        else { setRows(data ?? []); setTotal(count ?? null); setRefreshRequired(false); }
      }).catch(() => { if (active) { setError("Não foi possível consultar mensagens."); setRows([]); setTotal(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [term, filter, focusedId, page, revision]);

  function leaveFocusedRecord() {
    clearAdminFocusedRecordQuery();
    setFocusedId(null);
    setPage(0);
  }

  function chooseStatus(id: string, status: "respondida" | "arquivada" | "nova") {
    if (busyId || refreshRequired) return;
    setPending({ id, status });
    setReason("");
    setError(null);
    setSuccess(null);
  }

  async function updateStatus() {
    if (!pending || busyId || refreshRequired) return;
    const { id, status } = pending;
    const validation = validateAdminContactAction({
      action: "mark_message", reason, userId: null, phone: "",
      blockId: null, messageId: id, messageStatus: status,
    });
    if (validation) { setError(validation); return; }
    setBusyId(id); setError(null); setSuccess(null);
    let rpcConfirmed = false;
    try {
      const { data, error: actionError } = await db.rpc("eut_admin_contact_action", {
        _action: "mark_message", _user_id: null, _phone: null, _block_id: null,
        _message_id: id, _message_status: status, _reason: reason.trim(),
      });
      if (actionError || data?.ok !== true || data.action !== "mark_message")
        throw new Error("Audit RPC did not confirm update");
      rpcConfirmed = true;
      const { data: saved, error: readError } = await db.from("contact_messages")
        .select("id,status").eq("id", id).single();
      if (readError || saved?.id !== id || saved.status !== status)
        throw new Error("Persisted message status did not match");
      setPending(null);
      setReason("");
      setSuccess("Situação persistida e registrada na auditoria administrativa.");
      setRevision((n) => n + 1);
    } catch {
      // O servidor pode ter persistido a alteração mesmo se a confirmação de rede falhou.
      // Exigir nova escolha depois de consultar a lista evita reenvio acidental da ação auditada.
      setPending(null);
      setReason("");
      setRefreshRequired(true);
      setError(rpcConfirmed
        ? "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente."
        : "Não foi possível confirmar o resultado e sua auditoria. Atualize a lista antes de tentar novamente.");
    } finally { setBusyId(null); }
  }

  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  return <section className="mt-5 space-y-4" aria-label="Caixa de entrada administrativa">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Caixa de entrada</h2>
        <p className="mt-1 text-sm text-muted-foreground">Buscar, responder por e-mail externo e registrar alterações com motivo auditável. O painel não confirma o envio de e-mails.</p></div>
      <button type="button" onClick={() => setRevision((n) => n + 1)} disabled={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm disabled:opacity-40">
        <RefreshCcw className="h-4 w-4" /> Atualizar</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
      <label className="min-w-0 text-sm font-semibold">Localizar mensagem
        <span className="mt-1 flex items-center rounded-xl border border-input bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" /><input value={draft} onChange={(event) => { setDraft(event.target.value); leaveFocusedRecord(); }}
            placeholder="Assunto ou remetente" maxLength={70} className="min-h-12 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /></span>
      </label>
      <label className="text-sm font-semibold">Situação
        <select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); leaveFocusedRecord(); }}
          className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm">
          <option value="todas">Todas</option><option value="nova">Novas</option>
          <option value="respondida">Respondidas</option><option value="arquivada">Arquivadas</option>
        </select></label>
    </div>
    {focusedId && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      Registro localizado pela pesquisa global.
      <button type="button" onClick={leaveFocusedRecord}
        className="min-h-11 rounded-lg border border-input bg-background px-3 font-semibold">Voltar à lista</button>
    </div>}
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {success && <p role="status" className="rounded-lg border border-emerald-500/40 p-3 text-sm">{success}</p>}
    <p className="text-sm text-muted-foreground" role="status">{loading ? "Carregando…" :
      total === null ? "Total indisponível" : `${total.toLocaleString("pt-BR")} mensagem(ns) · página ${page + 1} de ${pages}`}</p>
    {!loading && !error && rows.length === 0 && <p className="rounded-lg border border-border p-4 text-sm">Nenhuma mensagem para este filtro.</p>}
    <ul className="grid gap-3" aria-busy={loading}>
      {!loading && rows.map((row) => <li key={row.id} id={`admin-registro-${row.id}`}
        className={"min-w-0 rounded-xl border bg-background p-4 " +
          (focusedId === row.id ? "border-primary ring-2 ring-primary/30" : "border-border")}>
        <div className="flex flex-wrap items-start justify-between gap-2"><strong className="break-words">{row.subject}</strong>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{row.status}</span></div>
        <p className="mt-1 break-words text-xs text-muted-foreground">{row.name} · {new Date(row.created_at).toLocaleString("pt-BR")}</p>
        <p className="mt-3 whitespace-pre-line break-words text-sm">{row.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`mailto:${row.email}?subject=${encodeURIComponent(`Re: ${row.subject}`)}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">Responder por e-mail</a>
          {row.status !== "respondida" && <button type="button" disabled={Boolean(busyId) || refreshRequired} onClick={() => chooseStatus(row.id, "respondida")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm disabled:opacity-40"><Check className="h-4 w-4" /> Marcar respondida</button>}
          {row.status !== "arquivada" ? <button type="button" disabled={Boolean(busyId) || refreshRequired} onClick={() => chooseStatus(row.id, "arquivada")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm disabled:opacity-40"><Archive className="h-4 w-4" /> Arquivar</button>
            : <button type="button" disabled={Boolean(busyId) || refreshRequired} onClick={() => chooseStatus(row.id, "nova")}
              className="min-h-11 rounded-lg border border-input px-3 text-sm disabled:opacity-40">Reabrir</button>}
        </div>
        {pending?.id === row.id && <form className="mt-3 grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
          onSubmit={(event) => { event.preventDefault(); void updateStatus(); }}>
          <p className="text-xs text-muted-foreground">
            Confirmar a situação {pending.status}. Esta anotação não comprova que um e-mail foi enviado.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Justificativa de auditoria (8 a 500 caracteres, sem dados privados)
            <input type="text" required minLength={8} maxLength={500} value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-background p-3 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={Boolean(busyId)}
              className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              Confirmar e auditar
            </button>
            <button type="button" disabled={Boolean(busyId)}
              onClick={() => { setPending(null); setReason(""); setError(null); }}
              className="min-h-11 rounded-lg border border-input px-4 text-sm">
              Cancelar
            </button>
          </div>
        </form>}
      </li>)}
    </ul>
    <nav aria-label="Paginação de mensagens" className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" disabled={loading || page === 0} onClick={() => setPage((n) => n - 1)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
      <span className="text-sm text-muted-foreground">{page + 1}/{pages}</span>
      <button type="button" disabled={loading || page + 1 >= pages} onClick={() => setPage((n) => n + 1)}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-input px-3 text-sm disabled:opacity-40">Próxima <ChevronRight className="h-4 w-4" /></button>
    </nav>
  </section>;
}
