import { describe, expect, it } from "vitest";
import { normalizeLegacyReviewSearch, LEGACY_REVIEW_PAGE_SIZE } from "./legacy-review-utils";

describe("admin migration review search", () => {
  it("keeps names and strips PostgREST control tokens", () => {
    expect(normalizeLegacyReviewSearch("  João  da  Silva %_(),.\\ ")).toBe("João da Silva");
    expect(normalizeLegacyReviewSearch("D'Ávila")).toBe("D'Ávila");
  });
  it("limits input and uses pages rather than loading every profile", () => {
    expect(normalizeLegacyReviewSearch("a".repeat(150))).toHaveLength(80);
    expect(LEGACY_REVIEW_PAGE_SIZE).toBeGreaterThan(0);
    expect(LEGACY_REVIEW_PAGE_SIZE).toBeLessThanOrEqual(50);
  });
});
