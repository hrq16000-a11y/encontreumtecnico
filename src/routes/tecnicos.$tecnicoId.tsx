import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";
import { getApprovedTechnician } from "../lib/technicians.functions";
import { isValidTechnicianId, isValidTechnicianSlug } from "@/lib/technician-id";
import { PublicTechnicianProfile } from "@/components/public-technician-profile";
import { getSeoProfileLinks } from "@/lib/public-seo-graph.functions";

export const Route = createFileRoute("/tecnicos/$tecnicoId")({
  // A published profile that does not exist must return a genuine HTTP 404,
  // not a content-filled HTTP 200 (soft 404). A database failure remains 500.
  loader: async ({ params }) => {
    const isLegacyUuid = isValidTechnicianId(params.tecnicoId);
    if (!isLegacyUuid && !isValidTechnicianSlug(params.tecnicoId)) throw notFound();
    const technician = await getApprovedTechnician({ data: { id: params.tecnicoId } });
    if (!technician) throw notFound();
    // Old UUID shares remain valid, but never compete with the readable canonical.
    if (isLegacyUuid) throw redirect({
      to: "/tecnicos/$tecnicoId", params: { tecnicoId: technician.public_slug }, statusCode: 301,
    });
    // Only an approved canonical profile receives public contextual interlinks.
    const seoLinks = await getSeoProfileLinks({ data: { slug: technician.public_slug } });
    return { ...technician, seoLinks };
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.display_name;
    const title = name ? `${name} — Técnico em ${loaderData.city} | Encontre um Técnico` : "Perfil do técnico — Encontre um Técnico";
    const desc = name
      ? `${name}: ${loaderData.specialties.join(", ")} em ${loaderData.city}.`
      : "Perfil público do técnico, especialidades e regiões atendidas.";
    const canonical = `https://www.encontreumtecnico.com.br/tecnicos/${loaderData?.public_slug ?? params.tecnicoId}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: canonical },
        ...(!loaderData ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: TechnicianProfilePage,
});

function TechnicianProfilePage() {
  const technician = Route.useLoaderData();
  return <PageShell><PublicTechnicianProfile technician={technician} links={technician.seoLinks} /></PageShell>;
}
