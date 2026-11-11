import { createFileRoute } from "@tanstack/react-router";
import { publicSitemapPartResponse } from "@/lib/public-sitemap-http";

export const Route = createFileRoute("/sitemaps/categorias.xml")({
  server: {
    handlers: {
      GET: () => publicSitemapPartResponse("categorias"),
    },
  },
});
