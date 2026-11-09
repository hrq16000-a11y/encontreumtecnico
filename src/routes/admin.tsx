import { createFileRoute } from "@tanstack/react-router";
import { PageShell, EmptyState } from "../components/page-placeholder";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
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

function AdminPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel administrativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesso restrito a administradores autorizados. O controle de acesso será implementado com
          permissões no servidor e RLS no Supabase. Módulos previstos:
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <EmptyState
            title="Técnicos e clientes"
            description="Aprovação, suspensão e revisão de cadastros."
          />
          <EmptyState
            title="Solicitações"
            description="Gerenciamento das solicitações de atendimento."
          />
          <EmptyState
            title="Indicadores"
            description="Métricas básicas de uso da plataforma."
          />
          <EmptyState
            title="Auditoria"
            description="Registro de ações administrativas."
          />
        </div>
      </section>
    </PageShell>
  );
}
