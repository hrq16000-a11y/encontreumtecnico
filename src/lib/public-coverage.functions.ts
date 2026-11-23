import { createServerFn } from "@tanstack/react-start";
import { getPublicGraphSnapshot } from "@/lib/public-seo-graph.functions";
import { groupPublishedCoverage, type CoverageLocation } from "@/lib/public-coverage";

export type PublicCoverageOverview = {
  locations: CoverageLocation[];
  publishedCount: number;
  locatedCount: number;
};

/** Same eligible, slug-deduplicated public corpus used by the SEO sitemap. */
async function loadApprovedCoverage(): Promise<PublicCoverageOverview> {
  const graph = await getPublicGraphSnapshot();
  const locations = groupPublishedCoverage(graph.profiles);
  const locatedCount = locations.reduce((total, location) => total + location.profiles.length, 0);
  return { locations, publishedCount: graph.profiles.length, locatedCount };
}

export const getPublicCoverageOverview = createServerFn({ method: "GET" })
  .handler(loadApprovedCoverage);
