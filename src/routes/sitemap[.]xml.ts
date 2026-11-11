import { createFileRoute } from "@tanstack/react-router";
import { buildPublicSitemapXml, loadPublishedSitemapProfiles } from "@/lib/public-sitemap";

// The same primary canonical host used by robots.txt and public profile metadata.
const SITE = "https://www.encontreumtecnico.com";
// Real, self-canonical public pages only. Never enumerate private pages, redirects,
// filtered search combinations, historical records or unpublished demos.
const PATHS = ["/", "/tecnicos", "/lp2", "/lp2/galeria", "/servicos", "/como-funciona", "/faq", "/contato", "/politicas", "/termos", "/privacidade", "/cookies", "/pagamentos-e-reembolsos", "/condicoes-do-prestador", "/responsabilidades", "/seguranca", "/direitos-dos-titulares"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Computed on the server from the public RLS-approved directory.
          // New/updated profiles flow into the XML without rebuilding Vercel.
          const profiles = await loadPublishedSitemapProfiles();
          const xml = buildPublicSitemapXml(PATHS, profiles);
          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            },
          });
        } catch {
          // Do not return an incomplete 200 sitemap when the database is down.
          console.error("Sitemap: published catalog unavailable");
          return new Response("Sitemap temporariamente indisponível", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "Retry-After": "300",
            },
          });
        }
      },
    },
  },
});
