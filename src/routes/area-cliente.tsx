import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "../components/page-placeholder";

export const Route = createFileRoute("/area-cliente")({
  head: () => ({
    meta: [
      { title: "Área do cliente — Encontre um Técnico" },
      {
        name: "description",
        content:
          "Painel do cliente: pesquisa de profissionais, solicitações de atendimento e histórico.",
      },
      { property: "og:title", content: "Área do cliente — Encontre um Técnico" },
      {
        property: "og:description",
        content:
          "Painel do cliente: pesquisa de profissionais, solicitações de atendimento e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientAreaPage,
});

function ClientAreaPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Área do cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta área será protegida por login na próxima rodada. Módulos previstos:
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <EmptyState
            title="Solicitações de atendimento"
            description="Abertura de novas solicitações e contato seguro com o técnico."
          />
          <EmptyState
            title="Histórico"
            description="Acompanhamento do status de todas as solicitações do cliente."
          />
        </div>
      </section>
    </PageShell>
  );
}
