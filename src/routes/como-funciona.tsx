import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — Encontre um Técnico" },
      {
        name: "description",
        content:
          "Entenda como clientes encontram técnicos aprovados e abrem solicitações de atendimento.",
      },
      { property: "og:title", content: "Como funciona — Encontre um Técnico" },
      {
        property: "og:description",
        content:
          "Entenda como clientes encontram técnicos aprovados e abrem solicitações de atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Como funciona</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Uma maneira melhor de encontrar e contratar profissionais de tecnologia.
        </p>

        <div className="mt-8 space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Para clientes</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Crie sua conta gratuitamente com login Google.</li>
              <li>Pesquise técnicos por especialidade, cidade e região.</li>
              <li>Abra uma solicitação de atendimento descrevendo o que precisa.</li>
              <li>Acompanhe o histórico e o andamento das suas solicitações.</li>
              <li>Entre em contato com o técnico pelo fluxo seguro da plataforma.</li>
            </ol>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">Para técnicos</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Cadastre-se com login Google e complete seu perfil profissional.</li>
              <li>Informe suas especialidades e as regiões que atende.</li>
              <li>Aguarde a aprovação cadastral pela administração.</li>
              <li>Após aprovado, seu perfil aparece na galeria pública.</li>
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-5">
            <h2 className="text-base font-semibold text-foreground">Segurança e privacidade</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados pessoais e contatos privados só são compartilhados mediante autorização, e toda
              solicitação é registrada na plataforma antes de qualquer contato externo.
            </p>
          </div>
        </div>

        <Link
          to="/entrar"
          className="mt-10 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Criar conta
        </Link>
      </section>
    </PageShell>
  );
}
