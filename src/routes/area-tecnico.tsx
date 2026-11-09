import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "../components/page-placeholder";

export const Route = createFileRoute("/area-tecnico")({
  head: () => ({
    meta: [
      { title: "Área do técnico — Encontre um Técnico" },
      { name: "description", content: "Painel do técnico: perfil profissional, especialidades, regiões atendidas e aprovação cadastral." },
      { property: "og:title", content: "Área do técnico — Encontre um Técnico" },
      { property: "og:description", content: "Painel do técnico: perfil profissional, especialidades, regiões atendidas e aprovação cadastral." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianAreaPage,
});

function TechnicianAreaPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Área do técnico</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta área será protegida por login na próxima rodada. Módulos previstos:
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <EmptyState
            title="Perfil profissional"
            description="Dados, foto, especialidades e regiões atendidas, com edição pelo próprio técnico."
          />
          <EmptyState
            title="Aprovação cadastral"
            description="Acompanhamento do status de aprovação do cadastro pela administração."
          />
        </div>
      </section>
    </PageShell>
  );
}
