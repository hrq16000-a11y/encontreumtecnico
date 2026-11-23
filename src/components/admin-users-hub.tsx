import { Link } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { ShieldCheck, UsersRound, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminAccountsManager } from "@/components/admin-accounts-manager";
import { AdminTechnicianUnifiedDirectory } from "@/components/admin-technician-unified-directory";

const USER_TABS = [
  { key: "todos", label: "Todos" },
  { key: "admins", label: "Admins" },
  { key: "clientes", label: "Clientes" },
  { key: "tecnicos", label: "Técnicos" },
] as const;
// Transitional access to the existing administrative tools; no records or roles are split.
const USER_MANAGEMENT_TOOLS = [
  { section: "tecnicos", label: "Gestão detalhada de técnicos" },
  { section: "clientes", label: "Gestão detalhada de clientes" },
  { section: "contas", label: "Bloqueios e auditoria de contas" },
  { section: "contatos", label: "Contatos e dados cadastrais" },
  { section: "legado", label: "Revisão de cadastros anteriores" },
  { section: "reivindicacoes", label: "Revisão de vínculos" },
] as const;
type UserTab = typeof USER_TABS[number]["key"];

function validUserTab(value: string | null): UserTab {
  return USER_TABS.find((tab) => tab.key === value)?.key ?? "todos";
}

type AdminUserRole = { user_id: string; created_at: string };
type AdminUserProfile = { id: string; full_name: string | null };

/** Uses the existing admin-authorized user_roles/profiles RLS policies; no role mutations. */
function AdminUsersList({ openAccount }: { openAccount: (id: string) => void }) {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Array<AdminUserRole & { name: string }>>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const result = await supabase.from("user_roles")
          .select("user_id,created_at", { count: "exact" }).eq("role", "admin")
          .order("created_at", { ascending: false }).range(page * 20, page * 20 + 19);
        if (result.error) throw result.error;
        const roles = (result.data ?? []) as AdminUserRole[];
        const ids = roles.map((item) => item.user_id);
        const profiles = ids.length
          ? await supabase.from("profiles").select("id,full_name").in("id", ids)
          : { data: [] as AdminUserProfile[], error: null };
        if (profiles.error) throw profiles.error;
        const names = new Map((profiles.data as AdminUserProfile[]).map((profile) => [profile.id, profile.full_name]));
        if (active) {
          setRows(roles.map((item) => ({ ...item, name: names.get(item.user_id) || "Administrador" })));
          setTotal(result.count ?? null);
        }
      } catch {
        if (active) { setRows([]); setTotal(null); setError(true); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [page]);

  return <section aria-label="Usuários administradores" className="space-y-4">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <h3 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Administradores</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Os papéis são consultados pelas permissões já existentes. Mudanças de privilégio e banimentos de administradores não estão disponíveis pelo CRUD atual.</p>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{loading ? "Consultando administradores…" : error ? "Consulta indisponível" : total === null ? "Total indisponível" : `${total} administrador(es) · página ${page + 1}`}</p>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">Não foi possível consultar os administradores com a permissão atual.</p>}
    {!error && !loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum administrador encontrado nesta página.</p>}
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-sm" aria-label="Administradores cadastrados">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr><th scope="col" className="p-3">Administrador</th><th scope="col" className="p-3 text-right">Ação</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((item) => <tr key={item.user_id}>
            <td className="min-w-0 p-3"><strong className="font-semibold">{item.name}</strong><p className="break-all text-xs text-muted-foreground">ID {item.user_id}</p></td>
            <td className="p-3 text-right"><button type="button" onClick={() => openAccount(item.user_id)}
              className="min-h-10 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-accent">Consultar conta</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex justify-between gap-3">
      <button type="button" disabled={loading || page === 0} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-lg border border-input px-4 disabled:opacity-40">Anterior</button>
      <button type="button" disabled={loading || total === null || (page + 1) * 20 >= total} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-lg border border-input px-4 disabled:opacity-40">Próximo</button>
    </div>
  </section>;
}

const adminDb = supabase as unknown as SupabaseClient;
type UnifiedRole = "todos" | "tecnico" | "cliente";
type UnifiedCursor = { after_name: string; after_key: string };
type LinkedIdentity = {
  record_key?: string; user_key?: string; name?: string; role?: string;
  email?: string | null; phone?: string | null; status?: string;
  profiles?: LinkedIdentity[];
};
type UnifiedUser = {
  user_key: string; record_key: string; auth_user_id: string | null;
  name: string; roles: string[]; status: "ATIVO" | "SUSPENSO";
  email?: string | null; phone?: string | null; professional_email?: string | null;
  linked_registry_phone?: string | null; address?: Record<string, string | null>;
  linked_imports?: LinkedIdentity[]; linked_legacy_accounts?: LinkedIdentity[];
  profiles?: LinkedIdentity[];
};
type UnifiedPage = {
  total: number; items: UnifiedUser[]; has_more: boolean;
  next_cursor: UnifiedCursor | null;
};
const LIST_SIZE = 30;

function UnifiedUsersList({ role, openAccount }: {
  role: UnifiedRole; openAccount: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"todos" | "ativo" | "suspenso">("todos");
  const [cursors, setCursors] = useState<Array<UnifiedCursor | null>>([null]);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [response, setResponse] = useState<UnifiedPage | null>(null);
  const [missingRpc, setMissingRpc] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (missingRpc) return;
    let active = true;
    setLoading(true);
    setResponse(null); // Never expose actions for a stale filtered page.
    setError(false);
    const cursor = cursors[page] ?? null;
    void Promise.resolve(adminDb.rpc("eut_admin_users_unified_360", {
      _search: search, _state: state, _role: role, _limit: LIST_SIZE,
      _after_name: cursor?.after_name ?? null, _after_key: cursor?.after_key ?? null,
    })).then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError?.code === "PGRST202" || queryError?.code === "42883") {
        setMissingRpc(true); // Fallback only when the function is not installed.
        return;
      }
      const pageData = data as unknown as UnifiedPage | null;
      if (queryError || !pageData || typeof pageData !== "object" ||
          !Array.isArray(pageData.items) || typeof pageData.total !== "number" ||
          typeof pageData.has_more !== "boolean" ||
          !pageData.items.every((item: UnifiedUser) =>
            typeof item.user_key === "string" && typeof item.name === "string" &&
            (item.status === "ATIVO" || item.status === "SUSPENSO") &&
            Array.isArray(item.roles))) {
        setError(true); // Authorization/network errors must not silently downgrade the query.
        return;
      }
      setResponse(pageData);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, search, state, page, refresh, missingRpc]);

  if (missingRpc) {
    return <section className="space-y-3" aria-label="Gestão de contas existente">
      <p role="status" className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        A consulta unificada ainda não está instalada. A gestão de contas existente continua disponível.
      </p>
      <AdminAccountsManager initialFilter={role === "todos" ? "todos" : role === "tecnico" ? "tecnicos" : "clientes"}
        lockFilter />
    </section>;
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim().slice(0, 80));
    setCursors([null]);
    setPage(0);
    setRefresh((value) => value + 1);
  }
  function changeState(next: "todos" | "ativo" | "suspenso") {
    setState(next);
    setCursors([null]);
    setPage(0);
  }
  function nextPage() {
    if (!response?.has_more || !response.next_cursor) return;
    setCursors((current) => [...current.slice(0, page + 1), response.next_cursor!]);
    setPage((value) => value + 1);
  }
  return <section aria-label="Consulta unificada de usuários" className="min-w-0 space-y-4">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <h3 className="text-base font-bold text-foreground">Usuários e cadastros unificados</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Consulte usuários e importados pela mesma busca. As edições utilizam os módulos administrativos existentes.
      </p>
    </div>
    <form onSubmit={submitSearch} className="flex min-w-0 flex-wrap items-end gap-2">
      <label className="grid min-w-0 flex-1 basis-52 gap-1 text-sm font-semibold">
        Buscar usuário, ID, contato ou município
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={80}
          className="min-h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 text-foreground"
          placeholder="Nome, ID, telefone ou e-mail" />
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
        Buscar
      </button>
      <label className="grid min-w-0 gap-1 text-sm font-semibold">
        Situação
        <select value={state} onChange={(event) => changeState(event.target.value as typeof state)}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground">
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="suspenso">Suspensos</option>
        </select>
      </label>
    </form>
    <p role="status" className="text-sm text-muted-foreground">
      {loading ? "Consultando usuários…" : error ? "Consulta unificada indisponível." :
        response ? `${response.total.toLocaleString("pt-BR")} usuário(s) · página ${page + 1} · até ${LIST_SIZE} por página` :
        "Nenhuma página disponível."}
    </p>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
      Não foi possível confirmar a consulta administrativa. A sessão e as permissões permanecem protegidas.
      <button type="button" onClick={() => setRefresh((value) => value + 1)}
        className="ml-3 min-h-10 rounded-lg border border-input px-3 font-semibold">Tentar novamente</button>
    </div>}
    {!error && !loading && response?.items.length === 0 &&
      <p className="rounded-lg border border-border p-4 text-sm">Nenhum usuário encontrado neste filtro.</p>}
    <ul className="grid min-w-0 gap-3">
      {response?.items.map((item) => {
        const technician = item.record_key.startsWith("registry:") ||
          item.record_key.startsWith("portal:");
        const history = item.record_key.startsWith("wp:") ||
          item.record_key.startsWith("legacy-account:");
        const linked = [...(item.linked_imports ?? []), ...(item.linked_legacy_accounts ?? []), ...(item.profiles ?? [])];
        const managementSection = technician ? "tecnicos" : history ? "legado" : null;
        return <li key={item.user_key} className="min-w-0 rounded-xl border border-border bg-card p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="break-words font-bold text-foreground">{item.name}</h4>
              <p className="mt-1 break-all text-xs text-muted-foreground">ID: {item.user_key}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.roles.join(" · ") || "Tipo não informado"}</p>
            </div>
            <span className={"rounded-full border px-3 py-1 text-xs font-bold " +
              (item.status === "SUSPENSO" ? "border-destructive/40 text-destructive" : "border-border text-foreground")}>
              {item.status}
            </span>
          </div>
          <div className="mt-3 grid min-w-0 gap-1 text-sm sm:grid-cols-2">
            <p className="min-w-0 break-all">E-mail: {item.email || item.professional_email || "Não informado"}</p>
            <p className="min-w-0 break-all">Telefone: {item.phone || item.linked_registry_phone || "Não informado"}</p>
          </div>
          {(linked.length > 0 || item.address) && <details className="mt-3 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">Outros dados e vínculos desta identidade</summary>
            {item.address && <p className="mt-2 break-words text-xs text-muted-foreground">
              Endereço: {Object.values(item.address).filter(Boolean).join(", ") || "Não informado"}
            </p>}
            {linked.map((entry, index) => <div key={entry.record_key || entry.user_key || String(index)}
              className="mt-2 border-t border-border pt-2 text-xs">
              <p className="break-all font-semibold">{entry.name || entry.record_key || entry.user_key || "Vínculo existente"}</p>
              <p className="break-all">{entry.role || entry.status || "Cadastro vinculado"}</p>
              {entry.email && <p className="break-all">E-mail: {entry.email}</p>}
              {entry.phone && <p className="break-all">Telefone: {entry.phone}</p>}
              {entry.profiles?.map((profile, profileIndex) => <p key={profile.record_key || String(profileIndex)}
                className="mt-1 break-all">{profile.record_key || "Perfil"} · {profile.name || "Sem nome"}
                {profile.phone ? ` · ${profile.phone}` : ""}{profile.email ? ` · ${profile.email}` : ""}</p>)}
            </div>)}
          </details>}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.auth_user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.auth_user_id) &&
              <button type="button" onClick={() => openAccount(item.auth_user_id!)}
                className="min-h-11 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary">
                Gerenciar conta
              </button>}
            {managementSection &&
              <a href={`/admin/${managementSection}?busca=${encodeURIComponent(item.name)}`}
                className="inline-flex min-h-11 items-center rounded-lg border border-input px-3 text-sm font-semibold hover:bg-accent">
                {technician ? "Abrir gestão de técnicos" : "Abrir acervo histórico"}
              </a>}
          </div>
          {item.record_key.startsWith("imported:") && !item.auth_user_id &&
            <p className="mt-2 text-xs text-muted-foreground">
              Este cadastro importado ainda não possui vínculo com um editor específico. A consulta é somente leitura.
            </p>}
        </li>;
      })}
    </ul>
    <div className="flex flex-wrap justify-between gap-2">
      <button type="button" disabled={loading || page === 0}
        onClick={() => setPage((value) => Math.max(0, value - 1))}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold disabled:opacity-40">
        Anterior
      </button>
      <button type="button" disabled={loading || !response?.has_more || !response.next_cursor}
        onClick={nextPage} className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold disabled:opacity-40">
        Próxima
      </button>
    </div>
  </section>;
}

export function AdminUsersHub({ adminOwnerId }: { adminOwnerId: string }) {
  const [tab, setTab] = useState<UserTab>("todos");
  const [managedAccountId, setManagedAccountId] = useState<string | null>(null);
  useEffect(() => {
    const syncTabFromUrl = () => setTab(validUserTab(new URLSearchParams(window.location.search).get("perfil")));
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);
  function selectTab(next: UserTab, accountId?: string) {
    setManagedAccountId(null);
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "todos") url.searchParams.delete("perfil");
    else url.searchParams.set("perfil", next);
    if (accountId) url.searchParams.set("registro", accountId);
    else url.searchParams.delete("registro");
    window.history.replaceState(window.history.state, "", url);
  }
  function openManagedAccount(id: string) {
    selectTab("todos", id);
    setManagedAccountId(id);
  }
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: UserTab) {
    const index = USER_TABS.findIndex((item) => item.key === current);
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % USER_TABS.length
      : event.key === "ArrowLeft" ? (index - 1 + USER_TABS.length) % USER_TABS.length
      : event.key === "Home" ? 0
      : event.key === "End" ? USER_TABS.length - 1 : null;
    if (nextIndex === null) return;
    const next = USER_TABS[nextIndex]?.key;
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    document.getElementById(`eut-user-tab-${next}`)?.focus();
  }

  return <section aria-labelledby="admin-usuarios-title" className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id="admin-usuarios-title" className="flex items-center gap-2 text-xl font-extrabold">
          <UsersRound className="h-6 w-6" aria-hidden="true" /> Usuários
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Pessoas, papéis e segurança em uma central compacta. Consulte os detalhes profissionais nos módulos especializados.</p>
      </div>
      <Link to="/admin/$secao" params={{ secao: "tecnicos" }}
        className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Gerenciar fichas técnicas
      </Link>
    </header>
    <div role="tablist" aria-label="Perfis dos usuários" className="flex flex-wrap gap-2">
      {USER_TABS.map((item) => <button key={item.key} id={`eut-user-tab-${item.key}`} role="tab" type="button"
        aria-selected={tab === item.key} aria-controls="eut-users-panel"
        tabIndex={tab === item.key ? 0 : -1}
        onClick={() => selectTab(item.key)}
        onKeyDown={(event) => onTabKeyDown(event, item.key)}
        className={"min-h-11 rounded-lg border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
          (tab === item.key ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent")}>
        {item.label}</button>)}
    </div>
    <div id="eut-users-panel" role="tabpanel" aria-labelledby={`eut-user-tab-${tab}`} className="min-w-0">
      {tab === "todos" && (managedAccountId
        ? <section className="space-y-3" aria-label="Gerenciar conta selecionada">
          <button type="button" onClick={() => selectTab("todos")}
            className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold">
            Voltar ao diretório de usuários
          </button>
          <AdminAccountsManager key={managedAccountId} initialFilter="todos" lockFilter />
        </section>
        : <UnifiedUsersList key="todos" role="todos" openAccount={openManagedAccount} />)}
      {tab === "admins" && <AdminUsersList openAccount={openManagedAccount} />}
      {tab === "clientes" && <UnifiedUsersList key="clientes" role="cliente" openAccount={openManagedAccount} />}
      {tab === "tecnicos" && <div className="space-y-4">
        <UnifiedUsersList key="tecnicos" role="tecnico" openAccount={openManagedAccount} />
        <div className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-5 w-5" aria-hidden="true" /> Fichas e edição de técnicos</div>
        <AdminTechnicianUnifiedDirectory adminOwnerId={adminOwnerId} />
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-semibold">Contas e bloqueios dos técnicos</summary>
          <div className="mt-4 min-w-0"><AdminAccountsManager key="tecnicos" initialFilter="tecnicos" lockFilter /></div>
        </details>
      </div>}
    </div>
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-bold">Ferramentas administrativas complementares</summary>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Os recursos anteriores continuam disponíveis enquanto suas operações são reunidas nesta central.
        Nenhum cadastro é duplicado ou separado por procedência.
      </p>
      <nav aria-label="Acessos às ferramentas de usuários existentes" className="mt-3 grid gap-2 sm:grid-cols-2">
        {USER_MANAGEMENT_TOOLS.map((item) => (
          <Link key={item.section} to="/admin/$secao" params={{ secao: item.section }}
            className="flex min-h-11 items-center rounded-lg border border-input px-3 py-2 text-sm font-semibold text-foreground hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {item.label}
          </Link>
        ))}
      </nav>
    </details>
  </section>;
}
