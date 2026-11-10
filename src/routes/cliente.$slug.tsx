import { createFileRoute, notFound } from "@tanstack/react-router";
import { getLegacyRouteReference } from "@/lib/legacy-route.functions";
import { HistoricalWordPressProfile } from "@/components/historical-wordpress-profile";

export const Route = createFileRoute("/cliente/$slug")({
  loader: async ({ params }) => {
    const reference = await getLegacyRouteReference({ data: { kind: "employer", slug: params.slug } });
    // No eligible public reference means an actual HTTP 404, not a soft-404 page.
    if (!reference) throw notFound();
    return reference;
  },
  head: ({ loaderData }) => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: loaderData?.display_name ? `${loaderData.display_name} — cadastro em validação` : "Cadastro histórico — Encontre um Técnico" },
      { name: "description", content: "Registro antigo de empresa ou contratante, ainda em validação e sem contato." },
    ],
  }),
  component: HistoricalEmployerPage,
});

function HistoricalEmployerPage() {
  return <HistoricalWordPressProfile kind="employer" reference={Route.useLoaderData()} />;
}
