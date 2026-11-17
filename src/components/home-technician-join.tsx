import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck, UserRoundCheck, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/** The only account lookup here is the authenticated session. Never reveal whether
 * an arbitrary email or phone belongs to a technician on a public page. */
export function HomeTechnicianJoin() {
  const { user, roles, loading, rolesError } = useAuth();
  const existingArea = roles.includes("admin") ? "/admin" as const
    : roles.includes("tecnico") ? "/area-tecnico" as const
    : roles.includes("cliente") ? "/area-cliente" as const : null;

  return (
    <section aria-labelledby="home-tecnico-cadastro" className="border-b border-border bg-gradient-to-b from-accent/70 to-background px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card px-3 py-1.5 text-xs font-bold text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> 100% gratuito para o técnico · sem mensalidade
          </p>
          <h2 id="home-tecnico-cadastro" className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            É técnico? Entre na rede sem perder seu cadastro anterior.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            Crie seu perfil ou retome sua conta. Depois de autenticar seu acesso, o sistema verifica
            contas anteriores e orienta a recuperação quando houver correspondência segura.
          </p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="flex flex-col rounded-3xl border border-primary/20 bg-card p-5 shadow-soft sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wrench className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Quero participar</p>
                <h3 className="text-xl font-bold text-card-foreground">Cadastro de profissional</h3>
              </div>
            </div>
            <ol className="mt-6 grid gap-3 text-sm text-foreground">
              <li className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> Entre com Google ou e-mail confirmado.</li>
              <li className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> O portal verifica seu vínculo existente depois do acesso.</li>
              <li className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> Complete ou atualize suas especialidades e região.</li>
            </ol>
            <Link to="/cadastro" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              Cadastrar gratuitamente <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">Pessoa física ou jurídica · CNPJ não é obrigatório.</p>
          </article>

          <article aria-label="Consultar ou recuperar cadastro" className="flex flex-col rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                {user && !loading && !rolesError ? <UserRoundCheck className="h-6 w-6" aria-hidden="true" /> : <KeyRound className="h-6 w-6" aria-hidden="true" />}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Não cadastre tudo de novo</p>
                <h3 className="text-xl font-bold text-card-foreground">Já tenho cadastro</h3>
              </div>
            </div>

            {loading ? <p role="status" className="mt-6 flex-1 text-sm text-muted-foreground">Verificando se você já está conectado…</p>
            : user && !rolesError && existingArea ? (
              <>
                <p role="status" className="mt-6 flex-1 text-sm leading-6 text-foreground">
                  Sua conta já está conectada. {roles.includes("tecnico")
                    ? "Identificamos seu acesso de técnico: continue no seu painel e atualize sua ficha."
                    : "Continue no painel existente sem criar uma segunda conta."}
                </p>
                <Link to={existingArea} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 px-5 text-sm font-bold text-primary hover:bg-primary/10">
                  Abrir meu painel <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <p className="mt-6 flex-1 text-sm leading-6 text-muted-foreground">
                  {user && !rolesError
                    ? "Seu acesso está conectado. Falta conferir a função da conta e possíveis registros anteriores."
                    : rolesError
                      ? "Não foi possível confirmar suas permissões agora. Reabra o acesso para tentar novamente."
                      : "Já participou da rede ou do portal antigo? Entre com o mesmo e-mail confirmado. A recuperação é feita após verificar a identidade, sem expor dados de terceiros."}
                </p>
                <Link to="/entrar" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 px-5 text-center text-sm font-bold text-primary hover:bg-primary/10">
                  {user && !rolesError ? "Conferir meu cadastro" : "Entrar ou recuperar cadastro"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/ajuda-acesso" className="mt-3 inline-flex min-h-11 items-center justify-center text-center text-xs font-semibold text-primary underline-offset-4 hover:underline">
                  Não consigo acessar meu cadastro antigo
                </Link>
              </>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
