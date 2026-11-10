import { createFileRoute, notFound } from "@tanstack/react-router";
import { getLegacyRouteReference } from "@/lib/legacy-route.functions";
import { HistoricalWordPressProfile } from "@/components/historical-wordpress-profile";

export const Route = createFileRoute("/tecnico/$slug")({
  loader: async ({ params }) => {
    const reference = await getLegacyRouteReference({ data: { kind: "candidate", slug: params.slug } });
    // No eligible public reference means an actual HTTP 404, not a soft-404 page.
    if (!reference) throw notFound();
    return reference;
  },
  head: ({ loaderData }) => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: loaderData?.display_name ? `${loaderData.display_name} — cadastro em validação` : "Cadastro histórico — Encontre um Técnico" },
      { name: "description", content: "Registro antigo de técnico, ainda em validação. Contato indisponível até aprovação." },
    ],
  }),
  component: HistoricalTechnicianPage,
});

function HistoricalTechnicianPage() {
  return <HistoricalWordPressProfile kind="candidate" reference={Route.useLoaderData()} />;
}
