import { createFileRoute, notFound } from "@tanstack/react-router";
import { AdminWorkspace } from "@/routes/admin";
import { validAdminModule } from "@/lib/admin-sections";

export const Route = createFileRoute("/admin_/$secao")({
  beforeLoad: ({ params }) => {
    if (!validAdminModule(params.secao)) throw notFound();
  },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Módulo administrativo — Encontre um Técnico" },
      { name: "description", content: "Área restrita à gestão autorizada do portal." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminModulePage,
});

function AdminModulePage() {
  const { secao } = Route.useParams();
  if (!validAdminModule(secao)) throw notFound();
  return <AdminWorkspace section={secao} />;
}
