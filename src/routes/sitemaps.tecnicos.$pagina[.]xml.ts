import { createFileRoute } from "@tanstack/react-router";
import { publicSitemapPartResponse } from "@/lib/public-sitemap-http";

export const Route = createFileRoute("/sitemaps/tecnicos/$pagina.xml")({
  server: {
    handlers: {
      GET: ({ params }) => {
        // Reject leading zero, zero, huge numbers, extensions and unknown shards.
        const raw = params.pagina;
        if (!/^[1-9][0-9]{0,5}$/.test(raw)) {
          return new Response("Sitemap section not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
        return publicSitemapPartResponse("tecnicos", Number(raw));
      },
    },
  },
});
