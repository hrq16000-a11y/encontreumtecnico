import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  canRevealAdminContact, validateAdminContactAction, type AdminContactAction,
} from "@/lib/admin-contact-controls";

const db = supabase as unknown as SupabaseClient;
type Filter = "todos" | "aprovado" | "pendente" | "suspenso" | "rejeitado" | "banidos" | "sem_contato";
type Technician = {
  id: string; user_id: string; display_name: string; status: string;
  city: string; state_uf: string | null; created_at: string;
  email: string | null; masked_phone: string | null; has_phone: boolean;
  allow_paid_contact: boolean; blocked_account: boolean; blocked_phone: boolean;
};
type Block = {
  kind: "telefone" | "conta"; ref_id: string; user_id: string | null;
  label: string; reason: string; added_at: string;
};
type Audit = {
  actor_id: string; action: string; subject_user_id: string | null;
  phone_last4: string | null; reference_id: string | null;
  reason: string; created_at: string;
};
type Message = {
  id: string; name: string; email: string; subject: string;
  message: string; status: string; created_at: string;
};
type Snapshot = {
  rows: Technician[]; blocked: Block[]; audit: Audit[]; messages: Message[];
  stats: Record<string, number>; total: number; page: number;
};
type Pending = {
  action: AdminContactAction; subject: Technician | null; block: Block | null;
  message: Message | null;
};
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "todos", label: "Todos" }, { key: "aprovado", label: "Aprovados" },
  { key: "pendente", label: "Pendentes" }, { key: "suspenso", label: "Suspensos" },
  { key: "rejeitado", label: "Rejeitados" }, { key: "banidos", label: "Banidos" },
  { key: "sem_contato", label: "Sem contato" },
];
const ACTION_LABELS: Record<AdminContactAction, string> = {
  block_account: "Banir conta", unblock_account: "Desbanir conta",
  suspend_account: "Suspender técnico", request_review: "Reabrir revisão",
  block_phone: "Bloquear telefone", unblock_phone: "Desbloquear telefone",
  mark_message: "Atualizar mensagem",
};

/** Uses only existing admin-checked, audited RPCs. Never loads private contacts into SSR or storage. */
export function AdminContactsDashboard({ adminId }: { adminId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [phoneToBlock, setPhoneToBlock] = useState("");
  const [messageStatus, setMessageStatus] = useState("respondida");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ owner: string; phone: string } | null>(null);
  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  function hidePhone() {
    if (revealTimeout.current) clearTimeout(revealTimeout.current);
    revealTimeout.current = null;
    setRevealed(null);
  }
  useEffect(() => () => {
    if (revealTimeout.current) clearTimeout(revealTimeout.current);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    hidePhone();
    void db.rpc("eut_admin_contacts_dashboard", {
      _search: search, _filter: filter, _page: page,
    }).then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError || !data || !Array.isArray(data.rows) ||
          !Array.isArray(data.blocked) || !Array.isArray(data.audit) ||
          typeof data.total !== "number" || data.page !== page) {
        setSnapshot(null);
        setError("Não foi possível consultar contatos. Confirme seu acesso administrativo.");
      } else {
        setSnapshot(data as Snapshot);
      }
    }).catch(() => {
      if (active) { setSnapshot(null); setError("Falha de conexão ao carregar contatos."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminId, search, filter, page, revision]);

  function choose(action: AdminContactAction, subject: Technician | null = null,
    block: Block | null = null, message: Message | null = null) {
    hidePhone();
    setPending({ action, subject, block, message });
    setReason(""); setPhoneToBlock(""); setMessageStatus("respondida");
    setError(""); setInfo("");
  }

  async function reveal(subject: Technician) {
    if (busy || !subject.has_phone) return;
    const reasonText = window.prompt(
      "Motivo do acesso ao número integral (8 a 500 caracteres). O acesso será registrado em auditoria:",
    )?.trim();
    if (!canRevealAdminContact(reasonText)) return;
    hidePhone(); setBusy(true); setError(""); setInfo("");
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_contact_reveal", {
        _user_id: subject.user_id, _reason: reasonText,
      });
      if (rpcError || data?.ok !== true || typeof data.phone !== "string" ||
          !/^\+[1-9]\d{7,14}$/.test(data.phone)) {
        throw new Error("O servidor não confirmou a leitura do contato.");
      }
      setRevealed({ owner: subject.user_id, phone: data.phone });
      revealTimeout.current = setTimeout(() => {
        setRevealed(null); revealTimeout.current = null;
      }, 60_000);
      setInfo("Número revelado apenas nesta tela por 60 segundos. Consulta auditada.");
    } catch {
      setError("Não foi possível consultar o número completo. Verifique as permissões.");
    } finally { setBusy(false); }
  }

  async function perform(event: FormEvent) {
    event.preventDefault();
    if (!pending || busy) return;
    const validation = validateAdminContactAction({
      action: pending.action, reason,
      userId: pending.subject?.user_id ?? pending.block?.user_id ?? null,
      phone: phoneToBlock, blockId: pending.block?.ref_id ?? null,
      messageId: pending.message?.id ?? null, messageStatus,
    });
    if (validation) { setError(validation); return; }
    if (pending.subject?.user_id === adminId) {
      setError("A conta administrativa atual não pode ser restringida.");
      return;
    }
    if (!window.confirm(`Confirmar ${ACTION_LABELS[pending.action]}? A ação será auditada no banco. O bloqueio de conta não remove bloqueios telefônicos.`)) return;
    setBusy(true); hidePhone(); setError(""); setInfo("");
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_contact_action", {
        _action: pending.action,
        _user_id: pending.subject?.user_id ?? pending.block?.user_id ?? null,
        _phone: pending.action === "block_phone" ? phoneToBlock.trim() : null,
        _block_id: pending.action === "unblock_phone" ? pending.block?.ref_id : null,
        _message_id: pending.message?.id ?? null,
        _message_status: pending.action === "mark_message" ? messageStatus : null,
        _reason: reason.trim(),
      });
      if (rpcError || data?.ok !== true || data.action !== pending.action) throw Error("unconfirmed");
      setPending(null); setReason(""); setPhoneToBlock("");
      setInfo("Operação confirmada pelo servidor e registrada na auditoria.");
      setRevision(x => x + 1);
    } catch {
      setError("Operação não confirmada. Consulte o estado atual antes de repetir.");
    } finally { setBusy(false); }
  }

  const totalPages = Math.max(1, Math.ceil((snapshot?.total ?? 0) / 20));
  return (
    <section aria-label="Central administrativa de contatos" className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-bold text-foreground">Contatos e gestão de acesso</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulte nome, e-mail, cidade, status e número completo quando necessário. A leitura
          do número exige motivo, fica auditada e desaparece desta tela após 60 segundos.
          Somente administradores autorizados podem chamar estas operações.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/admin/$secao" params={{ secao: "tecnicos" }} className="text-sm font-semibold text-primary underline">Editar dados e aprovar técnicos</Link>
          <Link to="/admin/$secao" params={{ secao: "contas" }} className="text-sm font-semibold text-primary underline">Gerenciar contas e banimentos</Link>
          <Link to="/admin/$secao" params={{ secao: "legado" }} className="text-sm font-semibold text-primary underline">Revisar WordPress</Link>
        </div>
      </div>
      {snapshot?.stats && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Técnicos", "total_tecnicos"], ["Aprovados", "aprovados"], ["Suspensos", "suspensos"],
          ["Sem número", "sem_numero"], ["Telefones bloqueados", "numeros_restritos"], ["Contas bloqueadas", "contas_restritas"],
        ].map(([label, field]) => (
          <div key={field} className="rounded-xl border border-border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">{snapshot.stats[field] ?? "—"}</dd>
          </div>
        ))}
      </dl>}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <form className="flex flex-wrap gap-2" onSubmit={e => {
          e.preventDefault(); setPage(0); setSearch(draftSearch.trim().slice(0,80));
        }}>
          <label className="sr-only" htmlFor="admin-contatos-buscar">Buscar técnicos, cidades, e-mails ou números</label>
          <input id="admin-contatos-buscar" value={draftSearch} onChange={e=>setDraftSearch(e.target.value)}
            placeholder="Nome, cidade, e-mail ou telefone" maxLength={80}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base" />
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">Pesquisar</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtro dos contatos">
          {FILTERS.map(item => (
            <button key={item.key} type="button" aria-pressed={filter===item.key}
              onClick={() => {setFilter(item.key);setPage(0);setPending(null);}}
              className={"min-h-10 rounded-lg border px-3 text-sm " +
                (filter===item.key ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground")}>
              {item.label}
            </button>
          ))}
        </div>
        {info && <p role="status" className="mt-4 rounded-lg bg-primary/5 p-3 text-sm text-foreground">{info}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        {loading && <p role="status" className="mt-4 text-sm">Carregando registros administrativos…</p>}
        {snapshot && !loading && <p role="status" className="mt-4 text-xs text-muted-foreground">
          {snapshot.total} técnico(s) no filtro · página {page+1} de {totalPages}
        </p>}
        {snapshot && <ul className="mt-3 grid gap-3">
          {snapshot.rows.map(item => (
            <li key={item.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="break-words text-sm text-foreground">{item.display_name}</strong>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-foreground">{item.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[item.city,item.state_uf].filter(Boolean).join(" / ")} · {item.email || "E-mail não informado"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Contato: {revealed?.owner===item.user_id ? revealed.phone : item.masked_phone ?? "não informado"}
                {item.blocked_account ? " · conta banida" : ""}
                {item.blocked_phone ? " · telefone banido" : ""}
                {!item.allow_paid_contact ? " · divulgação desautorizada" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.has_phone && <button type="button" disabled={busy} onClick={()=>void reveal(item)}
                  className="min-h-11 rounded-lg border border-input px-3 text-sm font-semibold text-foreground">
                  Ver número completo
                </button>}
                {revealed?.owner===item.user_id && <button type="button" onClick={hidePhone}
                  className="min-h-11 rounded-lg border border-input px-3 text-sm">Ocultar número</button>}
                {!item.blocked_account && <button type="button" onClick={()=>choose("block_account",item)}
                  className="min-h-11 rounded-lg border border-input px-3 text-sm">Banir conta</button>}
                {item.blocked_account && <button type="button" onClick={()=>choose("unblock_account",item)}
                  className="min-h-11 rounded-lg border border-input px-3 text-sm">Desbanir conta</button>}
                {item.status === "aprovado" && <button type="button" onClick={()=>choose("suspend_account",item)}
                  className="min-h-11 rounded-lg border border-input px-3 text-sm">Suspender</button>}
                {item.status === "suspenso" && <button type="button" onClick={()=>choose("request_review",item)}
                  disabled={item.blocked_account||item.blocked_phone}
                  className="min-h-11 rounded-lg border border-input px-3 text-sm disabled:opacity-50">Reabrir revisão</button>}
              </div>
            </li>
          ))}
          {!snapshot.rows.length && <li className="py-4 text-sm text-muted-foreground">Nenhum contato encontrado neste filtro.</li>}
        </ul>}
        <div className="mt-4 flex justify-between gap-2">
          <button type="button" disabled={loading||page===0} onClick={()=>{setPage(v=>Math.max(0,v-1));setPending(null);}}
            className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-50">Anterior</button>
          <button type="button" disabled={loading||page+1>=totalPages} onClick={()=>{setPage(v=>v+1);setPending(null);}}
            className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-50">Próxima</button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h3 className="font-semibold">Ações de telefone</h3>
        <button type="button" className="mt-2 min-h-11 rounded-lg border border-input px-4 text-sm"
          onClick={()=>choose("block_phone")}>Bloquear telefone por DDD e número</button>
        <button type="button" className="ml-2 mt-2 min-h-11 rounded-lg border border-input px-4 text-sm"
          onClick={()=>setShowBlocked(v=>!v)} aria-expanded={showBlocked}>
          {showBlocked?"Ocultar bloqueios":"Listar bloqueios"}
        </button>
        {showBlocked && <ul className="mt-3 grid gap-2">
          {snapshot?.blocked.map(block=><li key={block.kind+block.ref_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span className="break-words">{block.kind}: {block.label} · {block.reason}</span>
            {block.kind==="telefone" && <button type="button" onClick={()=>choose("unblock_phone",null,block)}
              className="min-h-10 rounded-lg border border-input px-3 text-sm">Desbloquear</button>}
            {block.kind==="conta" && <button type="button" onClick={()=>choose("unblock_account",null,block)}
              className="min-h-10 rounded-lg border border-input px-3 text-sm">Desbanir conta</button>}
          </li>)}
        </ul>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <button type="button" className="min-h-11 font-semibold text-primary"
          onClick={()=>setShowMessages(v=>!v)} aria-expanded={showMessages}>
          {showMessages ? "Ocultar mensagens" : "Gerenciar mensagens de contato"}
        </button>
        {showMessages && <ul className="mt-3 grid gap-3">
          {snapshot?.messages.map(message=><li key={message.id} className="rounded-lg border p-3">
            <strong className="text-sm">{message.name} · {message.subject}</strong>
            <p className="text-sm text-muted-foreground">{message.email} · {message.status}</p>
            <p className="mt-2 whitespace-pre-line break-words text-sm">{message.message}</p>
            <button type="button" className="mt-3 min-h-10 rounded-lg border px-3 text-sm"
              onClick={()=>choose("mark_message",null,null,message)}>Atualizar situação</button>
          </li>)}
        </ul>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <button type="button" className="min-h-11 font-semibold text-primary"
          aria-expanded={showAudit} onClick={()=>setShowAudit(v=>!v)}>
          {showAudit ? "Ocultar auditoria" : "Consultar auditoria de contatos"}
        </button>
        {showAudit && <ol className="mt-3 grid gap-2">
          {snapshot?.audit.map((item,index)=><li key={item.actor_id+item.created_at+index}
            className="rounded-lg border p-3 text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString("pt-BR")} · {item.action}
            {item.phone_last4 ? " · final "+item.phone_last4 : ""}
            {item.reason ? " · "+item.reason : ""}
          </li>)}
        </ol>}
      </div>
      {pending && <form onSubmit={perform} className="rounded-2xl border-2 border-primary/30 bg-card p-4 sm:p-6"
        aria-label="Confirmar operação administrativa auditada">
        <h3 className="font-bold text-foreground">{ACTION_LABELS[pending.action]}</h3>
        {pending.subject && <p className="mt-2 text-sm">{pending.subject.display_name}</p>}
        {pending.block && <p className="mt-2 text-sm">{pending.block.label}</p>}
        {pending.message && <p className="mt-2 text-sm">{pending.message.subject}</p>}
        {pending.action==="block_phone" && <label className="mt-3 block text-sm">Telefone com DDD
          <input type="tel" autoComplete="off" value={phoneToBlock} onChange={e=>setPhoneToBlock(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3" />
        </label>}
        {pending.action==="mark_message" && <label className="mt-3 block text-sm">Situação
          <select value={messageStatus} onChange={e=>setMessageStatus(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3">
            <option value="nova">Nova</option><option value="respondida">Respondida</option>
            <option value="arquivada">Arquivada</option>
          </select>
        </label>}
        <label className="mt-3 block text-sm">Motivo obrigatório (8–500 caracteres)
          <textarea value={reason} maxLength={500} rows={3} onChange={e=>setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background p-3" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Confirmando…" : "Confirmar operação"}
          </button>
          <button type="button" disabled={busy} className="min-h-11 rounded-lg border border-input px-4"
            onClick={()=>{setPending(null);setReason("");}}>Cancelar</button>
        </div>
      </form>}
      <p className="text-xs text-muted-foreground">
        Gestão de contatos originais do portal. Referências externas coletadas em quarentena
        não possuem telefone confiável nem conta autorizada aqui; não são habilitadas por esta tela.
        Alteração do telefone cadastrado e exclusão permanente requerem operações auditadas adicionais no servidor.
      </p>
    </section>
  );
}
