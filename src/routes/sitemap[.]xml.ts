import { createFileRoute } from "@tanstack/react-router";
import { buildPublicSitemapXml } from "@/lib/public-sitemap";
import { getPublicGraphSnapshot } from "@/lib/public-seo-graph.functions";

// Public, approved profiles + catalog-valid municipalities + active categories.
// Never export hidden contacts, IP, WordPress drafts, private leads or identities.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const graph = await getPublicGraphSnapshot();
          return new Response(buildPublicSitemapXml(
            graph.profiles, graph.cities, graph.categories,
          ), {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          // Database/catalog outages are 503, never misleading 200 with only static pages.
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
