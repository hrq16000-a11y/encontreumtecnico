import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactForm } from "@/components/contact-form";
import { PageShell } from "@/components/page-placeholder";

export const Route = createFileRoute("/ajuda-acesso")({
  head: () => ({
    meta: [
      { title: "Ajuda para entrar ou cadastrar — Encontre um Técnico" },
      { name: "description", content: "Solicite ajuda para erros de acesso, login ou cadastro." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccessSupportPage,
});

/** Suporte disponível sem login e sem expor critérios internos de moderação. */
function AccessSupportPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Central de ajuda</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            Dificuldade para entrar ou se cadastrar?
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Não conseguiu acessar sua conta, recuperar um cadastro antigo ou finalizar a inscrição?
            Descreva o que aconteceu para que nossa equipe possa orientar você.
            O suporte é gratuito e não exige login.
          </p>
          <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            Informe o tipo de erro, a etapa e, se possível, o horário. Nunca envie senhas,
            códigos de acesso, documentos ou dados bancários.
          </p>
          <div className="mt-6">
            <ContactForm
              initialSubject="Dificuldade de acesso ou cadastro"
              submitLabel="Enviar solicitação de ajuda"
            />
          </div>
          <Link to="/entrar" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            Voltar ao acesso
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
