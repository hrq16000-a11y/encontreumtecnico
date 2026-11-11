import { getPublicGraphSnapshot } from "@/lib/public-seo-graph.functions";
import {
  buildPublicSitemapPartXml,
  type PublicSitemapPart,
} from "@/lib/public-sitemap-index";

const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
  "X-Content-Type-Options": "nosniff",
};

/** 200 only for existing canonical URL sets, 404 for absent shards, 503 on DB failure. */
export async function publicSitemapPartResponse(
  kind: PublicSitemapPart["kind"],
  page?: number,
): Promise<Response> {
  try {
    const graph = await getPublicGraphSnapshot();
    const xml = buildPublicSitemapPartXml(graph, kind, page);
    if (xml === null) {
      return new Response("Sitemap section not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return new Response(xml, { status: 200, headers: XML_HEADERS });
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
