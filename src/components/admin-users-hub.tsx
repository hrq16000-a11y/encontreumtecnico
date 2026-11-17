import { useEffect, useState } from "react";
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
    <ul className="grid gap-2">
      {rows.map((item) => <li key={item.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
        <div className="min-w-0"><p className="font-semibold">{item.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">ID {item.user_id}</p></div>
        <button type="button" onClick={() => openAccount(item.user_id)} className="inline-flex min-h-11 items-center rounded-lg border border-input px-3 text-sm font-semibold">Consultar conta</button>
      </li>)}
    </ul>
    <div className="flex justify-between gap-3">
      <button type="button" disabled={loading || page === 0} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-lg border border-input px-4 disabled:opacity-40">Anterior</button>
      <button type="button" disabled={loading || total === null || (page + 1) * 20 >= total} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-lg border border-input px-4 disabled:opacity-40">Próximo</button>
    </div>
  </section>;
}

export function AdminUsersHub({ adminOwnerId }: { adminOwnerId: string }) {
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

  return <section aria-labelledby="admin-usuarios-title" className="min-w-0 space-y-5">
    <div>
      <h2 id="admin-usuarios-title" className="flex items-center gap-2 text-xl font-extrabold"><UsersRound className="h-6 w-6" aria-hidden="true" /> Central única de Usuários</h2>
      <p className="mt-2 text-sm text-muted-foreground">Gestão centralizada de contas, papéis e perfis técnicos. As operações continuam usando os contratos administrativos existentes.</p>
    </div>
    <div role="tablist" aria-label="Perfis dos usuários" className="flex flex-wrap gap-2">
      {USER_TABS.map((item) => <button key={item.key} id={`eut-user-tab-${item.key}`} role="tab" type="button"
        aria-selected={tab === item.key} aria-controls="eut-users-panel"
        onClick={() => selectTab(item.key)}
        className={"min-h-11 rounded-lg border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
          (tab === item.key ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent")}>
        {item.label}</button>)}
    </div>
    <div id="eut-users-panel" role="tabpanel" aria-labelledby={`eut-user-tab-${tab}`} className="min-w-0">
      {tab === "todos" && <AdminAccountsManager key="todos" initialFilter="todos" lockFilter />}
      {tab === "admins" && <AdminUsersList openAccount={(id) => selectTab("todos", id)} />}
      {tab === "clientes" && <AdminAccountsManager key="clientes" initialFilter="clientes" lockFilter />}
      {tab === "tecnicos" && <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-5 w-5" aria-hidden="true" /> Fichas e edição de técnicos</div>
        <AdminTechnicianUnifiedDirectory adminOwnerId={adminOwnerId} />
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-semibold">Contas e bloqueios dos técnicos</summary>
          <div className="mt-4 min-w-0"><AdminAccountsManager key="tecnicos" initialFilter="tecnicos" lockFilter /></div>
        </details>
      </div>}
    </div>
  </section>;
}
