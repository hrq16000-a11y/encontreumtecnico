import { GUIDE_ARTWORK } from "./guide-artwork";

/**
 * Home category media and service/profile media share ONE first-party
 * editorial source of truth. Do not duplicate the 8 SVG paths here.
 *
 * These drawings represent service topics, not real technicians or work.
 * Unrecognised categories use the existing neutral icon fallback.
 */
export const PUBLIC_CATEGORY_ILLUSTRATIONS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(GUIDE_ARTWORK).map(([slug, artwork]) => [slug, artwork.src]),
  ),
);

export function getPublicCategoryIllustration(slug: string): string | null {
  return Object.prototype.hasOwnProperty.call(PUBLIC_CATEGORY_ILLUSTRATIONS, slug)
    ? PUBLIC_CATEGORY_ILLUSTRATIONS[slug] ?? null
    : null;
}
