import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRoundSearch, Wrench, ArrowRight, ShieldCheck, UserCircle2, MapPin } from "lucide-react";
import { PageShell } from "@/components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { rememberSignupIntent, type SignupIntent } from "@/lib/signup-intent";
import { ConnectedGoogleIdentity } from "@/components/connected-google-identity";
import { useAuthDialog } from "@/components/auth-dialog";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [
    { name: "robots", content: "noindex, nofollow" },
    { title: "Criar minha conta — Encontre um Técnico" },
    { name: "description", content: "Comece como técnico ou cliente com Google ou e-mail e acompanhe tudo na sua área." },
  ] }),
  component: SignupHome,
});

function SignupHome() {
  const { user, roles, loading } = useAuth();
  const openAuth = useAuthDialog();
  const existingArea = roles.includes("admin") ? "/admin" as const
    : roles.includes("tecnico") ? "/area-tecnico" as const
    : roles.includes("cliente") ? "/area-cliente" as const : null;
  const cards: { intent: SignupIntent; icon: typeof Wrench; title: string; desc: string; benefits: string[] }[] = [
    { intent: "tecnico", icon: Wrench, title: "Sou técnico ou prestador",
      desc: "Cadastre seu perfil gratuitamente, selecione os serviços e as cidades atendidas.",
      benefits: ["Foto e perfil profissional", "Até cinco cidades e raio declarado", "Solicitações e indicações no meu painel"] },
    { intent: "cliente", icon: UserRoundSearch, title: "Preciso de um técnico",
      desc: "Encontre profissionais por serviço e região e acompanhe suas necessidades.",
      benefits: ["Busca local e GPS opcional", "Solicitações organizadas", "Contratação direta com o profissional"] },
  ];
  return <PageShell>
    <main className="min-h-[68vh] bg-gradient-to-b from-primary/10 via-background to-background pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-xs font-bold text-primary shadow-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Cadastro gratuito · Acesso protegido
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Seu espaço no Encontre um Técnico
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Escolha como vai usar o portal. Depois entre com Google ou e-mail:
            o sistema sugere nome e foto quando estiverem disponíveis, sem repetir dados à toa.
          </p>
        </div>
        {loading ? <p className="mt-10 text-center text-muted-foreground" role="status">Verificando sua conta…</p>
        : existingArea && user ? (
          <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-primary/20 bg-card p-6 shadow-sm">
            <ConnectedGoogleIdentity user={user} />
            <p className="mt-4 text-center text-sm text-foreground">Sua conta já possui um painel. Continue por ele, sem criar outro cadastro.</p>
            <Link to={existingArea} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
              Abrir minha conta <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            {user && <div className="mx-auto mt-7 max-w-lg"><ConnectedGoogleIdentity user={user} /></div>}
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {cards.map((card) => {
                const Icon = card.icon;
                return <article key={card.intent} className="group flex flex-col rounded-3xl border border-border bg-card p-6 shadow-md transition-shadow hover:shadow-lg sm:p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-card-foreground sm:text-2xl">{card.title}</h2>
                  <p className="mt-3 leading-6 text-muted-foreground">{card.desc}</p>
                  <ul className="my-6 grid gap-3 text-sm text-foreground">
                    {card.benefits.map((benefit) => <li key={benefit} className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {benefit}
                    </li>)}
                  </ul>
                  <button type="button" onClick={() => { rememberSignupIntent(card.intent); openAuth?.("cadastrar", card.intent); }}
                    className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                    {card.intent === "tecnico" ? "Cadastrar como técnico" : "Continuar como cliente"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </article>;
              })}
            </div>
            <div className="mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-5 py-4 text-center text-sm text-muted-foreground">
              <UserCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Já possui conta? <button type="button" onClick={() => openAuth?.("entrar")} className="font-bold text-primary underline-offset-4 hover:underline">Entrar no meu painel</button>
              <MapPin className="ml-1 h-4 w-4 text-primary" aria-hidden="true" />
              <span>Sem intermediação na contratação.</span>
            </div>
          </>
        )}
      </div>
    </main>
  </PageShell>;
}
