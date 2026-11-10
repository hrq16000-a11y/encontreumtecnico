import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
const inputStyle = "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
const buttonStyle = "min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";
const dangerStyle = "min-h-10 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50";
type View = "tecnicos" | "restricoes" | "mensagens" | "auditoria";
type StatusFilter = "todos" | "aprovado" | "pendente" | "suspenso" | "rejeitado" | "banidos" | "sem_contato";
type TechnicianContact = {
  id: string;
  user_id: string;
  display_name: string;
  city: string;
  state_uf: string | null;
  email: string | null;
  masked_phone: string | null;
  has_phone: boolean;
  allow_paid_contact: boolean;
  blocked_account: boolean;
  blocked_phone: boolean;
  status: string;
  created_at: string;
};
type Blocked = {
  kind: "conta" | "telefone";
  ref_id: string;
  user_id: string | null;
  label: string;
  reason: string;
  added_at: string;
};
type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "nova" | "respondida" | "arquivada";
  created_at: string;
};
type AuditRecord = {
  actor_id?: string;
  action: string;
  subject_user_id: string | null;
  phone_last4: string | null;
  reference_id: string | null;
  reason: string;
  created_at: string;
};
type Dashboard = {
  rows: TechnicianContact[];
  blocked: Blocked[];
  messages: ContactMessage[];
  audit: AuditRecord[];
  total: number;
  page: number;
  stats: {
    total_tecnicos: number;
    aprovados: number;
    suspensos: number;
    sem_numero: number;
    numeros_restritos: number;
    contas_restritas: number;
    mensagens_abertas: number;
  };
};
const filters: Array<{ value: StatusFilter; label: string }> = [
  { value: "todos", label: "Todos" }, { value: "aprovado", label: "Aprovados" },
  { value: "pendente", label: "Pendentes" }, { value: "suspenso", label: "Suspensos" },
  { value: "banidos", label: "Banidos" }, { value: "sem_contato", label: "Sem telefone" },
  { value: "rejeitado", label: "Rejeitados" },
];
const descriptions: Record<string,string> = {
  block_phone: "Número incluído na lista restrita. Perfis associados ficam suspensos.",
  unblock_phone: "Restrição deste número retirada. A conta permanece bloqueada se houver outra restrição.",
  block_account: "Conta e telefone associado restringidos.",
  unblock_account: "Restrição da conta retirada. Números eventualmente bloqueados permanecem restritos.",
  suspend_account: "Perfil suspenso, sem exposição pública nem liberação de contato.",
  request_review: "Perfil voltou para análise, sem aprovação automática.",
  mark_message: "Mensagem atualizada e registrada na auditoria.",
};
function fmtDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function idShort(id: string) {
  return id.length > 10 ? `${id.slice(0,8)}…` : id;
}

/**
 * RLS e autorização real são aplicadas nas RPCs do banco.
 * Este painel nunca consulta tabelas privadas diretamente nem salva telefones no navegador.
 */
export function AdminContactsCenter() {
  const [view, setView] = useState<View>("tecnicos");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("todos");
  const [page, setPage] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [reason, setReason] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [shown, setShown] = useState<Record<string,string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_contacts_dashboard", {
        _search: search, _filter: filter, _page: page,
      });
      if (rpcError || !data || typeof data !== "object") throw new Error("dashboard");
      setDashboard(data as Dashboard);
    } catch {
      setDashboard(null);
      setError("Não foi possível consultar a central. Confira sua permissão administrativa.");
    } finally {
      setLoading(false);
    }
  }, [search, filter, page]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setShown({}); }, [view, search, filter, page]);

  async function act(
    action: string,
    options: { userId?: string; phone?: string; blockId?: string; messageId?: string; messageStatus?: string } = {},
  ) {
    const note = reason.trim();
    if (note.length < 8 || note.length > 500) {
      setError("Informe a justificativa interna (de 8 a 500 caracteres) antes de executar a ação.");
      return;
    }
    const strong = ["block_phone", "block_account", "unblock_phone", "unblock_account"].includes(action);
    if (strong && !window.confirm(
      action.startsWith("unblock")
        ? "Retirar esta restrição? Isso não reativa automaticamente o perfil nem libera o telefone."
        : "Confirmar restrição? O perfil associado deixará de ser exibido e o contato será desativado."
    )) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_contact_action", {
        _action: action, _user_id: options.userId ?? null,
        _phone: options.phone ?? null, _block_id: options.blockId ?? null,
        _message_id: options.messageId ?? null,
        _message_status: options.messageStatus ?? null, _reason: note,
      });
      if (rpcError || data?.ok !== true) throw new Error("action");
      setInfo(descriptions[action] ?? "Operação registrada.");
      setReason("");
      if (action === "block_phone") setNewPhone("");
      setShown({});
      await refresh();
    } catch {
      setError("Não foi possível concluir a operação. Confira o cadastro, as restrições e sua permissão.");
    } finally { setBusy(false); }
  }

  async function reveal(userId: string) {
    const note = reason.trim();
    if (note.length < 8) {
      setError("Antes de consultar um telefone, informe uma justificativa interna de pelo menos 8 caracteres.");
      return;
    }
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_contact_reveal", {
        _user_id: userId, _reason: note,
      });
      if (rpcError || data?.ok !== true || typeof data.phone !== "string") throw new Error("reveal");
      setShown((old) => ({...old, [userId]: data.phone}));
      setInfo("Consulta individual registrada na auditoria. O número ficará visível apenas até atualizar ou ocultar.");
      setReason("");
    } catch {
      setError("Não foi possível consultar esse telefone privado.");
    } finally { setBusy(false); }
  }

  const stats = dashboard?.stats;
  const statCards = [
    ["Técnicos", stats?.total_tecnicos],
    ["Aprovados", stats?.aprovados],
    ["Suspensos", stats?.suspensos],
    ["Números restritos", stats?.numeros_restritos],
    ["Contas restritas", stats?.contas_restritas],
    ["Sem telefone", stats?.sem_numero],
    ["Mensagens novas", stats?.mensagens_abertas],
  ] as const;

  return (
    <section aria-label="Gestão administrativa de contatos" className="mt-10 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Administração privada</p>
          <h2 className="mt-1 text-xl font-bold text-card-foreground sm:text-2xl">Central de contatos e restrições</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Gerencie técnicos, telefones, contas restritas, atendimento e auditoria.
            Números particulares são mascarados e somente administradores autorizados podem consultá-los.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy || loading} className={buttonStyle}>Atualizar</button>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {statCards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-muted/30 p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-card-foreground">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 border-b border-border">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Módulos de gestão de contatos">
          {([
            ["tecnicos","Técnicos e contatos"],
            ["restricoes","Banidos e restrições"],
            ["mensagens","Suporte e mensagens"],
            ["auditoria","Histórico administrativo"],
          ] as const).map(([key,label]) => (
            <button type="button" role="tab" aria-selected={view === key} key={key}
              onClick={() => setView(key)}
              className={`min-h-11 rounded-t-lg px-3 text-sm font-semibold ${view===key?"border-b-2 border-primary bg-primary/5 text-primary":"text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block text-sm font-semibold text-foreground">
        Justificativa interna obrigatória para ações e consultas
        <textarea rows={2} maxLength={500} value={reason}
          onChange={(event)=>setReason(event.target.value)}
          className={`${inputStyle} mt-2`}
          placeholder="Informe o motivo documentado (mínimo 8 caracteres). Não inclua dados sensíveis desnecessários." />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Restrição, liberação, suspensão, consulta de telefone e triagem ficam registrados na auditoria. Retirar uma restrição não aprova automaticamente um técnico.
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {info && <p role="status" className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">{info}</p>}
      {loading && <p role="status" className="mt-4 text-sm text-muted-foreground">Atualizando dados administrativos…</p>}

      {view==="tecnicos" && (
        <div className="mt-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={event=>{
            event.preventDefault();setPage(0);setSearch(query.trim());setShown({});
          }}>
            <label className="flex-1 text-sm font-medium text-foreground">
              Buscar por técnico, cidade, e-mail ou número
              <input className={`${inputStyle} mt-1`} value={query} maxLength={80}
                onChange={event=>setQuery(event.target.value)}
                placeholder="Nome, e-mail, cidade ou número com DDD" />
            </label>
            <label className="sm:w-44 text-sm font-medium text-foreground">
              Situação
              <select className={`${inputStyle} mt-1`} value={filter}
                onChange={event=>{setFilter(event.target.value as StatusFilter);setPage(0);}}>
                {filters.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <button type="submit" className={`${buttonStyle} self-end`} disabled={busy}>Pesquisar</button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">Resultados: {dashboard?.total ?? "—"} · página {page+1}</p>
          {!loading && !dashboard?.rows.length && <p className="mt-5 text-sm text-muted-foreground">Nenhum contato encontrado para esta busca.</p>}
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {dashboard?.rows.map(contact => (
              <li key={contact.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-foreground">{contact.display_name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{contact.city}{contact.state_uf?`/${contact.state_uf}`:""} · {idShort(contact.user_id)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${contact.blocked_account||contact.blocked_phone?"border-destructive/40 text-destructive":"border-border text-muted-foreground"}`}>
                    {contact.blocked_account||contact.blocked_phone?"Restrito":contact.status}
                  </span>
                </div>
                <p className="mt-3 break-all text-sm text-muted-foreground">{contact.email ?? "Sem e-mail"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-foreground">
                  <span>Telefone: {shown[contact.user_id] ?? contact.masked_phone ?? "não informado"}</span>
                  {contact.has_phone && (shown[contact.user_id] ? (
                    <button type="button" className="text-sm font-semibold text-primary underline"
                      onClick={()=>setShown(old=>{const next={...old};delete next[contact.user_id];return next;})}>Ocultar</button>
                  ) : <button type="button" disabled={busy}
                    className="text-sm font-semibold text-primary underline"
                    onClick={()=>void reveal(contact.user_id)}>Consultar</button>)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Liberação de contato: {contact.allow_paid_contact?"autorizada pelo titular":"desativada"}
                  {contact.blocked_account?" · conta restrita":""}
                  {contact.blocked_phone?" · número restrito":""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {contact.status!=="suspenso" && (
                    <button type="button" className={buttonStyle} disabled={busy}
                      onClick={()=>void act("suspend_account",{userId:contact.user_id})}>Suspender</button>
                  )}
                  {contact.status==="suspenso" && !contact.blocked_account && !contact.blocked_phone && (
                    <button type="button" className={buttonStyle} disabled={busy}
                      onClick={()=>void act("request_review",{userId:contact.user_id})}>Enviar para revisão</button>
                  )}
                  {!contact.blocked_account && (
                    <button type="button" className={dangerStyle} disabled={busy}
                      onClick={()=>void act("block_account",{userId:contact.user_id})}>Banir conta e telefone</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-between gap-3">
            <button type="button" className={buttonStyle} disabled={busy || loading || page===0}
              onClick={()=>setPage(v=>Math.max(0,v-1))}>Anterior</button>
            <button type="button" className={buttonStyle}
              disabled={busy || loading || (page+1)*20 >= (dashboard?.total ?? 0)}
              onClick={()=>setPage(v=>v+1)}>Próxima</button>
          </div>
        </div>
      )}

      {view==="restricoes" && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <form className="rounded-xl border border-border bg-muted/20 p-4" onSubmit={event=>{
            event.preventDefault();void act("block_phone",{phone:newPhone.trim()});
          }}>
            <h3 className="font-semibold text-foreground">Restringir telefone manualmente</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Informe um número com DDD. Se estiver ligado a um técnico, o perfil será suspenso.
              As restrições são privadas e não notificam automaticamente o titular.
            </p>
            <input className={`${inputStyle} mt-3`} type="tel" required
              autoComplete="off" value={newPhone} maxLength={24}
              onChange={event=>setNewPhone(event.target.value)}
              placeholder="DDD e número" aria-label="Número para restrição" />
            <button type="submit" className={`${dangerStyle} mt-3 w-full`} disabled={busy}>Adicionar restrição</button>
          </form>
          <div>
            <h3 className="font-semibold text-foreground">Lista de restrições ({(dashboard?.stats.numeros_restritos??0)+(dashboard?.stats.contas_restritas??0)})</h3>
            <p className="mt-1 text-xs text-muted-foreground">Últimos 100 registros. Liberar um número não libera automaticamente a conta correspondente.</p>
            <ul className="mt-3 grid max-h-[600px] gap-3 overflow-auto">
              {dashboard?.blocked.map(block => (
                <li key={block.kind+block.ref_id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{block.label}</p>
                    <span className="text-xs text-muted-foreground">{block.kind}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{fmtDate(block.added_at)}</p>
                  <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{block.reason}</p>
                  <button type="button" className={`${buttonStyle} mt-3`} disabled={busy}
                    onClick={()=>void act(block.kind==="conta"?"unblock_account":"unblock_phone",
                      block.kind==="conta"?{userId:block.user_id??undefined}:{blockId:block.ref_id})}>
                    Retirar restrição {block.kind==="conta"?"da conta":"do telefone"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {view==="mensagens" && (
        <div className="mt-5">
          <h3 className="font-semibold text-foreground">Atendimento e dificuldade de acesso</h3>
          <p className="mt-1 text-xs text-muted-foreground">Últimas 40 solicitações, inclusive acesso e cadastro. Status administrável e auditado.</p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {dashboard?.messages.map(m=>(
              <li key={m.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-foreground">{m.subject}</p>
                  <span className="text-xs font-medium text-muted-foreground">{m.status}</span>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">{m.name} · {m.email} · {fmtDate(m.created_at)}</p>
                <p className="mt-3 whitespace-pre-line text-sm text-foreground">{m.message}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["nova","respondida","arquivada"] as const).filter(s=>s!==m.status).map(s=>(
                    <button type="button" className={buttonStyle} key={s} disabled={busy}
                      onClick={()=>void act("mark_message",{messageId:m.id,messageStatus:s})}>
                      {s==="nova"?"Reabrir":s==="respondida"?"Marcar respondida":"Arquivar"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {!loading && !dashboard?.messages.length && <p className="mt-4 text-sm text-muted-foreground">Nenhuma mensagem encontrada.</p>}
        </div>
      )}

      {view==="auditoria" && (
        <div className="mt-5">
          <h3 className="font-semibold text-foreground">Trilha das últimas decisões</h3>
          <p className="mt-1 text-xs text-muted-foreground">Últimos 40 eventos registrados. Não contém o número telefônico completo.</p>
          <ol className="mt-4 grid gap-3">
            {dashboard?.audit.map((log,i)=>(
              <li key={log.created_at+log.action+i} className="rounded-lg border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-foreground">{log.action.replaceAll("_"," ")}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(log.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.actor_id?`Administrador ${idShort(log.actor_id)} · `:""}
                  {log.phone_last4?`Telefone final ${log.phone_last4} · `:""}
                  {log.subject_user_id?`Conta ${idShort(log.subject_user_id)}`:""}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{log.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
