import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPublishedGuide } from "@/lib/public-guides";
import { getEnrichedServiceCategory } from "@/lib/service-catalog";

/**
 * Historical editorial URLs remain valid links, now 301 to the richer
 * catalog category holding the ORIGINAL content, visuals, FAQs and funnelling.
 * Do not duplicate those articles or delete any of their illustrations.
 */
export const Route = createFileRoute("/guias/$slug")({
  beforeLoad: ({ params }) => {
    const guide = getPublishedGuide(params.slug);
    if (!guide || !getEnrichedServiceCategory(guide.categorySlug)) throw notFound();
    throw redirect({
      to: "/servicos/$categoria",
      params: { categoria: guide.categorySlug },
      statusCode: 301,
    });
  },
});
