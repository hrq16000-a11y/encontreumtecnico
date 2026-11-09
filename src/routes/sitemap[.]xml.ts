import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://find-your-trusted-technician.lovable.app";
const PATHS = ["/", "/tecnicos", "/servicos", "/como-funciona", "/faq", "/contato", "/termos", "/privacidade"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const urls = PATHS.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml" } });
      },
    },
  },
});
