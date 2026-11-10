import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";

const CODE_PATTERN = /^[0-9a-f]{32}$/;

export const Route = createFileRoute("/convite/$codigo")({
  head: () => ({
    meta: [
      { title: "Convite para técnicos — Encontre um Técnico" },
      { name: "description", content: "Cadastre-se gratuitamente como prestador independente na rede Encontre um Técnico." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TechnicianInvitePage,
});

function TechnicianInvitePage() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const valid = CODE_PATTERN.test(codigo);

  function continueWithInvite() {
    if (!valid) return;
    // Same-origin session storage survives redirects to and from Google OAuth.
    // It records invitation intent only, not a claim or any private information.
    sessionStorage.setItem("eut-pending-technician-invite", codigo);
    navigate({ to: "/entrar" });
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">Convite para prestadores</span>
          <h1 className="mt-2 text-3xl font-bold text-card-foreground">Venha participar do Encontre um Técnico</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Você recebeu um link de indicação para conhecer nossa rede. O cadastro como técnico
            é gratuito e a negociação com clientes é direta, sem leilão de menor preço.
            Os profissionais informam suas próprias especialidades e áreas de atendimento.
          </p>
          <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground">
            <strong>Como funciona:</strong> entre ou cadastre-se, confirme sua identidade,
            escolha o perfil de técnico e preencha seus serviços e sua cidade. Seu convite
            poderá ser associado à conta depois que você confirmar a indicação no painel.
          </div>
          {valid ? (
            <button type="button" onClick={continueWithInvite}
              className="mt-6 min-h-11 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              Aceitar convite e entrar gratuitamente
            </button>
          ) : (
            <p role="alert" className="mt-6 text-sm text-destructive">
              Este link de convite não possui um formato válido. Peça um novo link ao profissional.
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            O convite não garante trabalho, posição nas buscas ou certificação técnica.
            Não é permitido enviar spam, revender contatos ou registrar contas falsas.
            Leia os <Link to="/termos" className="text-primary underline">termos</Link> e as{" "}
            <Link to="/condicoes-do-prestador" className="text-primary underline">condições do prestador</Link>.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
