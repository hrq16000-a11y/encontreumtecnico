import { Link } from "@tanstack/react-router";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ShieldCheck, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminAccountsManager } from "@/components/admin-accounts-manager";

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
  const [refreshRevision, setRefreshRevision] = useState(0);
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
  }, [page, refreshRevision]);

  return <section aria-label="Usuários administradores" className="space-y-4">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <h3 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> Administradores</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Os papéis são consultados pelas permissões já existentes. Mudanças de privilégio e banimentos de administradores não estão disponíveis pelo CRUD atual.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-sm text-muted-foreground">{loading ? "Consultando administradores…" : error ? "Consulta indisponível" : total === null ? "Total indisponível" : `${total} administrador(es) · página ${page + 1}`}</p>
      <button type="button" disabled={loading}
        onClick={() => setRefreshRevision((revision) => revision + 1)}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold hover:bg-accent disabled:opacity-40">
        {error ? "Tentar novamente" : "Atualizar lista"}
      </button>
    </div>
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

export function AdminUsersHub(_props: { adminOwnerId: string }) {
  const [tab, setTab] = useState<UserTab>("todos");
  useEffect(() => {
    const syncTabFromUrl = () => setTab(validUserTab(new URLSearchParams(window.location.search).get("perfil")));
    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);
  function selectTab(next: UserTab, accountId?: string) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "todos") url.searchParams.delete("perfil");
    else url.searchParams.set("perfil", next);
    if (accountId) url.searchParams.set("registro", accountId);
    else url.searchParams.delete("registro");
    window.history.replaceState(window.history.state, "", url);
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
      {tab === "todos" && <AdminAccountsManager key="todos" initialFilter="todos" lockFilter initialLayout="table" />}
      {tab === "admins" && <AdminUsersList openAccount={(id) => selectTab("todos", id)} />}
      {tab === "clientes" && <AdminAccountsManager key="clientes" initialFilter="clientes" lockFilter initialLayout="table" />}
      {tab === "tecnicos" && <div className="space-y-3">
        <p className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          Esta lista mostra contas vinculadas ao papel técnico. Para consultar e editar fichas profissionais,
          inclusive cadastros anteriores sem identidade vinculada, use
          {" "}<Link to="/admin/$secao" params={{ secao: "tecnicos" }} className="font-semibold text-primary underline">Gestão detalhada de técnicos</Link>.
        </p>
        <AdminAccountsManager key="tecnicos" initialFilter="tecnicos" lockFilter initialLayout="table" />
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
