import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, Ban, CheckCircle2, LockKeyhole, Pencil, RotateCcw, Search, ShieldCheck, Smartphone, UsersRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Filter = "todos" | "tecnicos" | "clientes" | "sem_papel" | "bloqueados";
type Account = {
  id: string; full_name: string; masked_email: string | null; masked_phone: string | null;
  email_confirmed: boolean; roles: string; is_admin: boolean; is_client: boolean;
  is_technician: boolean; technician_id: string | null; technician_status: string | null;
  blocked_account: boolean; blocked_phone: boolean; created_at: string;
};
type PhoneBlock = { id: string; masked_phone: string; reason: string; added_at: string };
type AuditEvent = {
  actor_id: string; action: string; subject_user_id: string | null;
  phone_last4: string | null; reason: string; created_at: string;
};
type Snapshot = { total: number; page: number; page_size: number;
  accounts: Account[]; blocked_phones: PhoneBlock[]; audit: AuditEvent[] };
type Action = "block_account" | "unblock_account" | "edit_name" | "block_phone" | "unblock_phone";
type Selection = { action: Action; user: Account | null; block: PhoneBlock | null };
const db = supabase as unknown as SupabaseClient;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todas as contas" },
  { value: "tecnicos", label: "Técnicos" }, { value: "clientes", label: "Clientes" },
  { value: "sem_papel", label: "Sem perfil escolhido" }, { value: "bloqueados", label: "Bloqueados" },
];
const ACTION_NAMES: Record<Action, string> = {
  block_account: "Banir conta", unblock_account: "Retirar banimento da conta",
  edit_name: "Editar nome da conta", block_phone: "Restringir telefone",
  unblock_phone: "Retirar restrição do telefone",
};

/** Read and write only through explicitly admin-guarded RPCs. Never use auth.admin in the browser. */
export function AdminAccountsManager({ initialFilter = "todos" }: { initialFilter?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [draftSearch, setDraftSearch] = useState(() => typeof window === "undefined" ? "" :
    new URLSearchParams(window.location.search).get("q")?.slice(0, 80) ?? "");
  const [search, setSearch] = useState(draftSearch);
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [reason, setReason] = useState("");
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showPhones, setShowPhones] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<"block_account" | "unblock_account" | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get("registro");
    const deepLinkedSearch = recordId && /^[a-f0-9-]{36}$/i.test(recordId) ? recordId : params.get("busca");
    if (!deepLinkedSearch) return;
    const cleaned = deepLinkedSearch.trim().replace(/[\p{C}]/gu, "").slice(0, 80);
    setDraftSearch(cleaned);
    setSearch(cleaned);
    setPage(0);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const { data, error: queryError } = await db.rpc("eut_admin_accounts_snapshot", {
          _search: search, _filter: filter, _page: page,
        });
        if (!active) return;
        if (queryError || !data || !Array.isArray(data.accounts)) {
          setSnapshot(null);
          setError("Não foi possível carregar a gestão de contas. Confirme a sessão administrativa e as permissões.");
        } else {
          setSnapshot(data as Snapshot);
          setError(null);
        }
      } catch {
        if (active) { setSnapshot(null); setError("Falha de conexão. Tente novamente."); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filter, page, search, version]);

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkAction(null);
    setSelection(null);
  }, [filter, page, search]);

  function choose(action: Action, user: Account | null = null, block: PhoneBlock | null = null) {
    if (bulkBusy) return;
    if (user?.is_admin) {
      setError("Contas administrativas não podem ser alteradas por este módulo.");
      return;
    }
    setSelection({ action, user, block });
    setReason("");
    setValue(action === "edit_name" ? user?.full_name ?? "" : "");
    setNotice(null);
    setError(null);
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearch(draftSearch.trim().slice(0, 80));
    setPage(0);
    setSelection(null);
    setSelectedIds(new Set());
    setBulkAction(null);
  }

  function toggleAccountSelection(id: string) {
    setSelectedIds((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function applyBulk(event: FormEvent) {
    event.preventDefault();
    const justification = bulkReason.trim();
    const rows = (snapshot?.accounts ?? []).filter((account) =>
      selectedIds.has(account.id) && !account.is_admin &&
      (bulkAction === "block_account" ? !account.blocked_account : account.blocked_account));
    if (!bulkAction || busy || bulkBusy || rows.length === 0 ||
      justification.length < 8 || justification.length > 400) return;
    const label = bulkAction === "block_account" ? "banir" : "desbanir";
    if (!window.confirm(`Confirmar ${label} ${rows.length} conta(s) desta página? ` +
      "Cada operação terá justificativa e será conferida individualmente. Restrições de telefone não serão removidas.")) return;
    setBulkBusy(true);
    setNotice(null);
    setError(null);
    let confirmed = 0;
    let unconfirmed = 0;
    for (const account of rows) {
      try {
        const actionResponse: { data: unknown; error: unknown } = await db.rpc("eut_admin_contact_action", {
          _action: bulkAction, _user_id: account.id, _phone: null,
          _block_id: null, _message_id: null, _message_status: null, _reason: justification,
        });
        const actionResult = actionResponse.data as { ok?: boolean; action?: string } | null;
        if (actionResponse.error || actionResult?.ok !== true || actionResult?.action !== bulkAction)
          throw new Error("action_failed");
        const { data: checkedData, error: checkError } = await db.rpc("eut_admin_accounts_snapshot", {
          _search: account.id, _filter: "todos", _page: 0,
        });
        const checked = checkedData as Snapshot | null;
        const persisted = checked?.accounts?.find((item: Account) => item.id === account.id);
        if (checkError || !persisted || persisted.blocked_account !== (bulkAction === "block_account"))
          throw new Error("unverified");
        confirmed++;
      } catch {
        unconfirmed++;
      }
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
    setBulkAction(null);
    setBulkReason("");
    setVersion((v) => v + 1);
    setNotice(`${confirmed} conta(s) com estado persistido confirmado. ` +
      (unconfirmed ? `${unconfirmed} operação(ões) sem confirmação completa; revise antes de repetir.` :
        "Cada operação utilizou o RPC administrativo auditado."));
  }

  async function apply(event: FormEvent) {
    event.preventDefault();
    if (busy || bulkBusy || !selection) return;
    const justification = reason.trim();
    if (justification.length < 8 || justification.length > 400) {
      setError("Informe um motivo de 8 a 400 caracteres.");
      return;
    }
    if (selection.action === "block_phone" && value.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone completo com DDD, para conferência e bloqueio.");
      return;
    }
    if (!window.confirm(
      `Confirmar "${ACTION_NAMES[selection.action]}"? Esta operação será registrada na auditoria. ` +
      (selection.action === "unblock_account" ? "Telefones bloqueados NÃO serão desbloqueados automaticamente." :
       selection.action === "block_account" ? "Solicitações novas e publicação do perfil serão bloqueadas." :
       "A identidade original do usuário será preservada.")
    )) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (selection.action === "edit_name") {
        const { data, error: actionError } = await db.rpc("eut_admin_account_edit_name", {
          _user_id: selection.user?.id, _full_name: value.trim(), _reason: justification,
        });
        if (actionError) throw actionError;
        if (!data?.ok || data?.user_id !== selection.user?.id) throw new Error("O banco não confirmou a edição.");
      } else {
        const args = {
          _action: selection.action,
          _user_id: selection.user?.id ?? null,
          _phone: selection.action === "block_phone" ? value.trim() : null,
          _block_id: selection.block?.id ?? null,
          _message_id: null, _message_status: null,
          _reason: justification,
        };
        const { data, error: actionError } = await db.rpc("eut_admin_contact_action", args);
        if (actionError) throw actionError;
        if (!data?.ok || data?.action !== selection.action) throw new Error("O banco não confirmou a alteração.");
      }
      const completed = ACTION_NAMES[selection.action];
      setSelection(null);
      setValue("");
      setNotice(completed + " — operação confirmada e auditada no Supabase. Consulte o estado atualizado.");
      setVersion((v) => v + 1);
    } catch (e) {
      setError("Não foi possível concluir a ação. " + (e instanceof Error ? e.message.slice(0, 240) : "Consulte o suporte."));
    } finally { setBusy(false); }
  }

  const maxPage = snapshot ? Math.max(1, Math.ceil(snapshot.total / snapshot.page_size)) : 1;
  const eligibleAccounts = (snapshot?.accounts ?? []).filter((account) => !account.is_admin);
  const allSelected = eligibleAccounts.length > 0 && eligibleAccounts.every((account) => selectedIds.has(account.id));
  const selectedAccounts = eligibleAccounts.filter((account) => selectedIds.has(account.id));
  const actionableCount = selectedAccounts.filter((account) => bulkAction === "block_account"
    ? !account.blocked_account : account.blocked_account).length;
  return <section aria-label="Contas e bloqueios administrativos" className="mt-2 space-y-5">
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Contas, bloqueios e auditoria</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Controle real de usuários Google/e-mail. O banimento é persistente para esta conta e restringe
            novas operações; não exclui a conta do Google ou os dados do cliente.
          </p>
        </div>
      </div>
    </div>
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
      <label className="sr-only" htmlFor="eut-admin-account-search">Pesquisar contas</label>
      <input id="eut-admin-account-search" value={draftSearch} onChange={(e) => setDraftSearch(e.target.value)}
        placeholder="Buscar por nome, e-mail ou identificador" maxLength={80}
        className="min-h-12 flex-1 rounded-xl border border-input bg-background px-4 text-foreground" />
      <button type="submit" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
        <Search className="h-4 w-4" aria-hidden="true" /> Buscar
      </button>
    </form>
    <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Filtro de contas">
      {FILTERS.map((item) => <button key={item.value} type="button"
        aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setPage(0); setSelection(null); setSelectedIds(new Set()); setBulkAction(null); }}
        className={"min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold " +
          (filter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent")}>
        {item.label}</button>)}
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm text-foreground">{notice}</p>}
    {selection && <form onSubmit={(e) => void apply(e)}
      className="space-y-4 rounded-2xl border-2 border-primary/25 bg-card p-5 shadow-sm" aria-label="Confirmar alteração de conta">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-foreground">{ACTION_NAMES[selection.action]}</h3>
          {selection.user && <p className="mt-1 text-sm text-muted-foreground">{selection.user.full_name} · {selection.user.masked_email}</p>}
          {selection.block && <p className="mt-1 text-sm text-muted-foreground">{selection.block.masked_phone}</p>}
        </div>
        <button type="button" onClick={() => setSelection(null)} aria-label="Cancelar alteração"
          className="rounded-lg border border-input p-2 text-foreground"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      {selection.action === "edit_name" && <label className="block text-sm font-semibold text-foreground">Nome completo
        <input required minLength={3} maxLength={100} value={value} onChange={(e) => setValue(e.target.value)}
          className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 text-foreground" /></label>}
      {selection.action === "block_phone" && <label className="block text-sm font-semibold text-foreground">Telefone com DDD
        <input type="tel" required maxLength={20} value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="DDD + telefone; número integral não é exibido no painel"
          className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 text-foreground" /></label>}
      <label className="block text-sm font-semibold text-foreground">Motivo administrativo obrigatório
        <textarea required minLength={8} maxLength={400} rows={3} value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Registre a justificativa, sem divulgar dados pessoais desnecessários"
          className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-foreground" /></label>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <LockKeyhole className="h-4 w-4" aria-hidden="true" /> A operação é protegida pelo papel de administrador e auditada.
      </p>
      <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60">
        <CheckCircle2 className="h-4 w-4" /> {busy ? "Confirmando no banco…" : "Confirmar e registrar"}
      </button>
    </form>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-sm text-muted-foreground">
        {loading ? "Consultando contas…" : !snapshot ? "Consulta indisponível" : `${snapshot.total} conta(s) · página ${page + 1} de ${maxPage}`}
      </p>
      <button type="button" onClick={() => setVersion((v) => v + 1)}
        className="min-h-10 rounded-lg border border-input px-4 text-sm text-foreground hover:bg-accent">Atualizar</button>
    </div>
    {snapshot && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3" aria-label="Organização dos cadastros">
      <span className="text-xs font-semibold text-muted-foreground">Por data de cadastro:</span>
      <button type="button" disabled={loading || bulkBusy} onClick={() => { setPage(0); setSelectedIds(new Set()); setBulkAction(null); }}
        className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-semibold">Mais recentes</button>
      <button type="button" disabled={loading || bulkBusy} onClick={() => { setPage(maxPage - 1); setSelectedIds(new Set()); setBulkAction(null); }}
        className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-semibold">Cadastros mais antigos</button>
      <span className="text-xs text-muted-foreground">20 por página · ordem cronológica do banco</span>
    </div>}
    {snapshot && <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4" aria-label="Ações em massa de contas">
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={allSelected} disabled={busy || bulkBusy || !eligibleAccounts.length}
          onChange={() => setSelectedIds(allSelected ? new Set() : new Set(eligibleAccounts.map((account) => account.id)))} />
        Selecionar contas desta página ({eligibleAccounts.length} elegíveis)
      </label>
      <p role="status" className="text-xs text-muted-foreground">{selectedAccounts.length} selecionada(s). Administradores e outras páginas não são selecionados.</p>
      {selectedAccounts.length > 0 && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || bulkBusy} aria-pressed={bulkAction === "block_account"}
          onClick={() => { setSelection(null); setBulkAction("block_account"); setBulkReason(""); }}
          className="min-h-11 rounded-lg border border-destructive/40 bg-background px-3 text-sm font-semibold">Banir selecionadas</button>
        <button type="button" disabled={busy || bulkBusy} aria-pressed={bulkAction === "unblock_account"}
          onClick={() => { setSelection(null); setBulkAction("unblock_account"); setBulkReason(""); }}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-semibold">Desbanir selecionadas</button>
        <button type="button" disabled={bulkBusy} onClick={() => { setSelectedIds(new Set()); setBulkAction(null); }}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">Limpar seleção</button>
      </div>}
      {bulkAction && <form onSubmit={(event) => void applyBulk(event)} className="space-y-2 rounded-lg border border-border bg-background p-3">
        <p className="text-sm">{actionableCount} de {selectedAccounts.length} conta(s) selecionada(s) permitem esta operação. Restrições de telefone permanecem independentes.</p>
        <label className="block text-sm font-semibold">Motivo administrativo para auditoria do lote
          <textarea required minLength={8} maxLength={400} value={bulkReason} onChange={(event) => setBulkReason(event.target.value)}
            className="mt-1 min-h-24 w-full rounded-lg border border-input p-3" /></label>
        <button type="submit" disabled={busy || bulkBusy || actionableCount === 0 || bulkReason.trim().length < 8}
          className="min-h-12 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-40">
          {bulkBusy ? "Confirmando cada conta…" : "Confirmar ações auditadas"}
        </button>
      </form>}
    </div>}
    {!loading && snapshot && snapshot.accounts.length === 0 &&
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhuma conta neste filtro. Usuários WordPress antigos só aparecem aqui após confirmar sua identidade no sistema novo.
      </div>}
    <ul className="grid gap-3">
      {snapshot?.accounts.map((account) => <li key={account.id}
        className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {!account.is_admin && <label className="mb-2 flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground">
              <input type="checkbox" disabled={busy || bulkBusy} checked={selectedIds.has(account.id)}
                onChange={() => toggleAccountSelection(account.id)} aria-label={`Selecionar ${account.full_name}`} /> Selecionar para lote
            </label>}
            <h3 className="font-bold text-foreground">{account.full_name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{account.masked_email ?? "Sem e-mail"} · {account.roles || "Papel não escolhido"}</p>
            {account.masked_phone && <p className="mt-1 text-xs text-muted-foreground">Contato: {account.masked_phone}</p>}
            {account.technician_status && <p className="mt-1 text-xs text-muted-foreground">Perfil técnico: {account.technician_status}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {account.is_admin && <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Administrador protegido</span>}
            {account.blocked_account && <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">Conta banida</span>}
            {account.blocked_phone && <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">Telefone bloqueado</span>}
            {!account.is_admin && !account.blocked_account && !account.blocked_phone &&
              <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Sem bloqueio</span>}
          </div>
        </div>
        {!account.is_admin && <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => choose("edit_name", account)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold text-foreground hover:bg-accent">
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar nome</button>
          {account.blocked_account
            ? <button type="button" onClick={() => choose("unblock_account", account)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold text-foreground hover:bg-accent">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Desbanir conta</button>
            : <button type="button" onClick={() => choose("block_account", account)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/5">
              <Ban className="h-4 w-4" aria-hidden="true" /> Banir conta</button>}
        </div>}
      </li>)}
    </ul>
    <div className="flex justify-between gap-2">
      <button type="button" disabled={loading || page===0} onClick={() => setPage((x) => Math.max(0,x-1))}
        className="min-h-11 rounded-lg border border-input px-4 text-sm text-foreground disabled:opacity-40">Anterior</button>
      <button type="button" disabled={loading || !snapshot || (page+1)*snapshot.page_size>=snapshot.total}
        onClick={() => setPage((x) => x + 1)}
        className="min-h-11 rounded-lg border border-input px-4 text-sm text-foreground disabled:opacity-40">Próximo</button>
    </div>
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Telefones restritos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold text-foreground"><Smartphone className="h-5 w-5" aria-hidden="true" /> Telefones restritos</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => choose("block_phone")}
            className="min-h-11 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">Restringir número</button>
          <button type="button" onClick={() => setShowPhones((x) => !x)}
            aria-expanded={showPhones} className="min-h-11 rounded-lg border border-input px-3 text-sm text-foreground">
            {showPhones ? "Ocultar lista" : "Ver restrições"}</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">A lista oculta os dígitos completos. Remover a restrição telefônica não remove automaticamente o banimento individual de uma conta.</p>
      {showPhones && <ul className="mt-4 grid gap-2">
        {(snapshot?.blocked_phones ?? []).length === 0 && <li className="text-sm text-muted-foreground">Nenhuma restrição telefônica nesta consulta.</li>}
        {snapshot?.blocked_phones.map((block) => <li key={block.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
          <span className="text-sm font-semibold text-foreground">{block.masked_phone}</span>
          <button type="button" onClick={() => choose("unblock_phone",null,block)}
            className="min-h-10 rounded-lg border border-input px-3 text-sm text-foreground hover:bg-accent">Desbloquear telefone</button>
        </li>)}
      </ul>}
    </section>
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Auditoria de bloqueios">
      <button type="button" onClick={() => setShowAudit((x) => !x)} aria-expanded={showAudit}
        className="flex min-h-11 w-full items-center justify-between text-left text-sm font-bold text-foreground">
        <span className="flex items-center gap-2"><UsersRound className="h-5 w-5" aria-hidden="true" /> Últimas ações de moderação</span>
        <span className="text-xs text-primary">{showAudit ? "Ocultar" : "Mostrar"}</span>
      </button>
      {showAudit && <ul className="mt-4 space-y-2">
        {(snapshot?.audit ?? []).length === 0 && <li className="text-sm text-muted-foreground">Ainda não existem ações neste histórico.</li>}
        {snapshot?.audit.map((event, i) => <li key={event.created_at + String(i)} className="rounded-lg border border-border p-3 text-xs text-foreground">
          <p className="font-bold">{event.action} · {new Date(event.created_at).toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-muted-foreground">{event.reason}</p>
        </li>)}
      </ul>}
    </section>
    <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      Banimento aqui bloqueia operações na plataforma, mas não elimina o login no provedor Google.
      Novos e-mails sem telefone reconhecido ainda exigem controle no Auth Hook do Supabase.
      Criação por convite e exclusão definitiva não estão habilitadas neste módulo.
    </p>
  </section>;
}
