import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "../components/page-placeholder";

export const Route = createFileRoute("/tecnicos/$tecnicoId")({
  head: () => ({
    meta: [
      { title: "Perfil do técnico — Encontre um Técnico" },
      { name: "description", content: "Perfil público do técnico, especialidades e regiões atendidas." },
      { property: "og:title", content: "Perfil do técnico — Encontre um Técnico" },
      { property: "og:description", content: "Perfil público do técnico, especialidades e regiões atendidas." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianProfilePage,
});

function TechnicianProfilePage() {
  const { tecnicoId } = Route.useParams();

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Perfil do técnico</h1>
        <p className="mt-1 text-sm text-muted-foreground">Identificador: {tecnicoId}</p>
        <div className="mt-6">
          <EmptyState
            title="Perfil indisponível"
            description="As páginas individuais dos técnicos serão preenchidas quando houver perfis aprovados na plataforma."
          />
        </div>
      </section>
    </PageShell>
  );
}
