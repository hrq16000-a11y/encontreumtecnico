import { createFileRoute } from "@tanstack/react-router";
import { buildPublicSitemapIndexXml } from "@/lib/public-sitemap-index";
import { getPublicGraphSnapshot } from "@/lib/public-seo-graph.functions";

// Sitemap index: each child stays inside the same canonical host and has real URLs.
// Never export hidden contacts, WordPress drafts, leads or private identities.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const graph = await getPublicGraphSnapshot();
          return new Response(buildPublicSitemapIndexXml(graph), {
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
