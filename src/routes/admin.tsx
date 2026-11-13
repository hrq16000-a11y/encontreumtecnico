import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { RequestCard, type Req } from "../components/request-list";
import { useAuth } from "@/hooks/use-auth";
import { ConnectedGoogleIdentity } from "@/components/connected-google-identity";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SearchMetrics } from "@/components/search-metrics";
import { LegacyReviewQueue } from "@/components/legacy-review-queue";
import { LegacyClaimReview } from "@/components/legacy-claim-review";
import { EutAdminManager } from "@/components/eut-admin-manager";
import { AdminControlHub } from "@/components/admin-control-hub";
import { AdminCommandOverview } from "@/components/admin-command-overview";
import { AdminAdvertisingManager } from "@/components/admin-advertising-manager";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminTechnicianManager } from "@/components/admin-technician-manager";
import { AdminTechnicianCreate } from "@/components/admin-technician-create";
import { AdminOwnTechnicianRole } from "@/components/admin-own-technician-role";
import { AdminMemberInvites } from "@/components/admin-member-invites";
import { AdminAccountsManager } from "@/components/admin-accounts-manager";
import { AdminContactsDashboard } from "@/components/admin-contacts-dashboard";
import { AdminClientInsights } from "@/components/admin-client-insights";
import { adminModuleTitle, type AdminSection } from "@/lib/admin-sections";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Administração — Encontre um Técnico" },
      { name: "description", content: "Painel administrativo restrito a administradores autorizados." },
      { property: "og:title", content: "Administração — Encontre um Técnico" },
      { property: "og:description", content: "Painel administrativo restrito a administradores autorizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const ADMIN_QUICK_LINKS = [
  { section: "tecnicos", label: "Técnicos" },
  { section: "solicitacoes", label: "Solicitações" },
  { section: "contas", label: "Contas e bloqueios" },
  { section: "contatos", label: "Contatos privados" },
] as const satisfies ReadonlyArray<{ section: AdminSection; label: string }>;

export function AdminPage() {
  return <AdminWorkspace section="inicio" />;
}

export function AdminWorkspace({ section }: { section: AdminSection }) {
  const lp2 = useContext(LP2EmbeddedContext);
  const { user, roles, loading, rolesError, refreshRoles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [reqs, setReqs] = useState<Req[]>([]);
  const [msgs, setMsgs] = useState<Tables<"contact_messages">[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [technicianCreateVersion, setTechnicianCreateVersion] = useState(0);

  async function load() {
    // A page only queries the records it needs. RLS remains authoritative.
    // No global prefetch of private contacts when browsing sponsors or metrics.
    const needsRequests = section === "solicitacoes";
    const needsMessages = section === "mensagens";
    const [r, m] = await Promise.all([
      needsRequests
        ? supabase.from("service_requests").select("*").order("created_at", { ascending: false }).limit(500)
        : Promise.resolve({ data: [] as Req[], error: null }),
      needsMessages
        ? supabase.from("contact_messages").select("*").neq("status", "arquivada").order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] as Tables<"contact_messages">[], error: null }),
    ]);
    setError(r.error || m.error ? "Não foi possível carregar os dados deste módulo." : null);
    setReqs(r.data ?? []);
    setMsgs(m.data ?? []);
  }

  async function setMsgStatus(id: string, status: "respondida" | "arquivada") {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
    if (error) setError("Não foi possível atualizar a mensagem.");
    else load();
  }
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, section]);

  const btn = "min-h-11 rounded-md px-4 text-sm font-medium disabled:opacity-50";

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-7 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Gestão protegida · Encontre um Técnico</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{section === "inicio" ? "Painel administrativo" : adminModuleTitle(section)}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Administração organizada por módulo. A navegação não modifica permissões nem publica registros históricos.
          </p>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <p className="mt-4 text-sm text-muted-foreground"><Link to={lp2 ? "/lp2/entrar" : "/entrar"} className="text-primary underline">Entre</Link> com uma conta de administrador.</p>
        ) : rolesError ? (
          <div role="alert" className="max-w-2xl rounded-2xl border border-destructive/30 bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Não foi possível confirmar suas permissões</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sua sessão continua conectada. Não é necessário criar outra conta.</p>
            <button type="button" onClick={() => void refreshRoles()}
              className="mt-4 min-h-12 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Tentar novamente</button>
          </div>
        ) : !isAdmin ? (
          <div className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">Esta conta não possui permissão de administrador</h2>
            <p className="mt-2 text-sm text-muted-foreground">As áreas administrativas são privadas. Se você é cliente ou técnico, utilize sua própria área sem repetir o login.</p>
            <Link to={roles.includes("tecnico") ? "/area-tecnico" : roles.includes("cliente") ? "/area-cliente" : "/entrar"}
              className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
              Abrir minha área <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
            <AdminNavigation active={section} />
            <main className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
              aria-label={"Módulo administrativo: " + adminModuleTitle(section)}>
            <ConnectedGoogleIdentity user={user} />
            <nav aria-label="Atalhos rápidos da administração"
              className="mt-4 rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acesso rápido</p>
              <p className="mt-1 text-xs text-muted-foreground">Atalhos internos. As permissões de cada ação continuam protegidas.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ADMIN_QUICK_LINKS.map((item) => (
                  <Link key={item.section} to="/admin/$secao" params={{ secao: item.section }}
                    aria-current={section === item.section ? "page" : undefined}
                    className={"inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (section === item.section
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary hover:text-primary")}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
            {(section === "inicio" || section === "tecnicos") &&
              <AdminOwnTechnicianRole isTechnician={roles.includes("tecnico")} refreshRoles={refreshRoles} />}
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
                        {section === "inicio" && (<section aria-label="Resumo administrativo">
              <AdminCommandOverview />
              <AdminControlHub />
            </section>)}
            {section === "patrocinadores" && <section aria-label="Patrocinadores e banners"><div id="admin-patrocinadores"><AdminAdvertisingManager /></div></section>}
            {section === "metricas" && <section aria-label="Buscas e indicadores"><div id="admin-metricas"><SearchMetrics /></div></section>}
            {section === "legado" && <section aria-label="Acervo WordPress"><div id="admin-legado"><LegacyReviewQueue /></div></section>}
            {section === "reivindicacoes" && <section aria-label="Reivindicações"><div id="admin-reivindicacoes"><LegacyClaimReview /></div></section>}
            {section === "catalogo" && <section aria-label="Categorias e serviços"><div id="admin-catalogo"><EutAdminManager /></div></section>}
            {section === "contas" && <section aria-label="Contas e bloqueios"><AdminMemberInvites /><AdminAccountsManager /></section>}
            {section === "contatos" && <section aria-label="Contatos administrativos"><AdminContactsDashboard adminId={user.id} /></section>}
            {section === "tecnicos" && <section aria-label="Gestão de técnicos">
              <AdminMemberInvites initialRole="tecnico" />
              <AdminTechnicianCreate adminId={user.id} onCreated={() => setTechnicianCreateVersion(v => v + 1)} />
              <div key={technicianCreateVersion}><AdminTechnicianManager adminOwnerId={user.id} /></div>
            </section>}
            {section === "mensagens" && <section aria-label="Mensagens administrativas">
              <h2 id="admin-mensagens" className="mt-10 scroll-mt-20 text-lg font-semibold text-foreground">Mensagens de contato</h2>
            {msgs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma mensagem recebida.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {msgs.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-semibold text-card-foreground">{m.subject}</p>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">{m.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.name} · <a className="text-primary underline" href={`mailto:${m.email}`}>{m.email}</a> · {new Date(m.created_at).toLocaleString("pt-BR")}</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-card-foreground">{m.message}</p>
                    <div className="mt-3 flex gap-2">
                      {m.status !== "respondida" && <button onClick={() => setMsgStatus(m.id, "respondida")} className={`${btn} bg-primary text-primary-foreground`}>Marcar respondida</button>}
                      {m.status !== "arquivada" && <button onClick={() => setMsgStatus(m.id, "arquivada")} className={`${btn} border border-input text-foreground`}>Arquivar</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            </section>}
            {section === "solicitacoes" && <section aria-label="Solicitações registradas">
              <h2 id="admin-solicitacoes" className="mt-10 scroll-mt-20 text-lg font-semibold text-foreground">Solicitações recentes</h2>
            {reqs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma solicitação aberta ainda.</p>
            ) : (
              <ul className="mt-3 grid gap-3">{reqs.slice(0, 50).map((r) => <RequestCard key={r.id} r={r} />)}</ul>
            )}
            </section>}
            {section === "clientes" && <section aria-labelledby="admin-clientes-titulo">
              <h2 id="admin-clientes-titulo" className="text-xl font-bold text-foreground">Clientes e solicitações</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Gerencie os clientes por identidade confirmada, convite, nome e bloqueios auditados. Os dados de solicitações privadas são consultados somente no módulo Solicitações. Exclusões definitivas exigem procedimento próprio de privacidade.</p>
              <AdminMemberInvites initialRole="cliente" />
              <AdminClientInsights />
              <AdminAccountsManager initialFilter="clientes" />
              <div className="mt-5 rounded-xl border border-border bg-muted/20 p-5">
                <h3 className="font-bold text-foreground">Solicitações em módulo protegido</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Esta tela consulta apenas a lista administrativa de contas. Descrições dos problemas
                  e identificadores de solicitantes não são carregados desnecessariamente aqui.
                  Para consultar os atendimentos, abra o módulo Solicitações.
                </p>
              </div>
              <div className="mt-5 rounded-xl border border-border bg-card p-5">
                <h3 className="font-bold text-foreground">Atividades disponíveis</h3>
                <p className="mt-2 text-sm text-muted-foreground">Os detalhes dos atendimentos estão no módulo de solicitações. Esta tela não revela e-mail, telefone ou dados de autenticação dos clientes sem uma política segura de acesso.</p>
                <Link to="/admin/$secao" params={{ secao: "solicitacoes" }} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Consultar solicitações <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </section>}

</main>
          </div>
        )}
      </section>
    </PageShell>
  );
}
