import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext } from "react";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { ConnectedGoogleIdentity } from "@/components/connected-google-identity";
import { SearchMetrics } from "@/components/search-metrics";
import { LegacyReviewQueue } from "@/components/legacy-review-queue";
import { LegacyClaimReview } from "@/components/legacy-claim-review";
import { EutAdminManager } from "@/components/eut-admin-manager";
import { AdminControlHub } from "@/components/admin-control-hub";
import { AdminCommandOverview } from "@/components/admin-command-overview";
import { AdminRequestQueue } from "@/components/admin-request-queue";
import { AdminMessageQueue } from "@/components/admin-message-queue";
import { AdminAdvertisingManager } from "@/components/admin-advertising-manager";
import { AdminNavigation } from "@/components/admin-navigation";
import { AdminTechnicianUnifiedDirectory } from "@/components/admin-technician-unified-directory";
import { AdminOwnTechnicianRole } from "@/components/admin-own-technician-role";
import { AdminMemberInvites } from "@/components/admin-member-invites";
import { AdminAccountsManager } from "@/components/admin-accounts-manager";
import { AdminContactsDashboard } from "@/components/admin-contacts-dashboard";
import { AdminClientInsights } from "@/components/admin-client-insights";
import { adminModuleTitle, type AdminSection } from "@/lib/admin-sections";
import { ArrowRight, ClipboardList, PhoneCall, ShieldBan, Wrench } from "lucide-react";

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
  { section: "tecnicos", label: "Técnicos", icon: Wrench },
  { section: "solicitacoes", label: "Solicitações", icon: ClipboardList },
  { section: "contas", label: "Contas e bloqueios", icon: ShieldBan },
  { section: "contatos", label: "Contatos privados", icon: PhoneCall },
] as const satisfies ReadonlyArray<{ section: AdminSection; label: string; icon: typeof Wrench }>;

export function AdminPage() {
  return <AdminWorkspace section="inicio" />;
}

export function AdminWorkspace({ section }: { section: AdminSection }) {
  const lp2 = useContext(LP2EmbeddedContext);
  const { user, roles, loading, rolesError, refreshRoles } = useAuth();
  const isAdmin = roles.includes("admin");

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
                    <item.icon className="mr-2 inline h-4 w-4 shrink-0 align-text-bottom" aria-hidden="true" /> {item.label}
                  </Link>
                ))}
              </div>
            </nav>
            {section === "inicio" &&
              <AdminOwnTechnicianRole isTechnician={roles.includes("tecnico")} refreshRoles={refreshRoles} />}
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
              <AdminTechnicianUnifiedDirectory adminOwnerId={user.id} />
              <details className="mt-4 min-w-0 rounded-xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">Operações complementares e ações em lote</summary>
                <div className="mt-5 min-w-0"><LegacyReviewQueue onlyTechnicians /></div>
              </details>
            </section>}
            {section === "mensagens" && <AdminMessageQueue />}
            {section === "solicitacoes" && <AdminRequestQueue />}
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
