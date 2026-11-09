/** Only a literal human-readable name search; never forward wildcard syntax. */
export function normalizeLegacyReviewSearch(value: string): string {
  return value
    .replace(/[^A-Za-zÀ-ÿ0-9 '’-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export const LEGACY_REVIEW_PAGE_SIZE = 24;
