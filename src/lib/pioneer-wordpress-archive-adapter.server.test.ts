import { describe, expect, it } from "vitest";
import { findWordPressOriginalAliasCandidates } from "./pioneer-wordpress-archive-adapter.server";

const original = {
  source_key: "wordpress_20261108", wp_post_id: 123,
  kind: "candidate", title: "almeidathiagosantos5",
};
const review = { ...original, demo_candidate: false };

describe("offline WordPress original-alias source reconciliation", () => {
  it("reuses the versioned source_key:wp_post_id convention without public IDs or phones", () => {
    const output = findWordPressOriginalAliasCandidates([original], [review]);
    expect(output).toEqual([{
      sourceId: "wordpress_20261108:123", candidateOriginalAlias: "almeidathiagosantos5",
    }]);
    expect(JSON.stringify(output)).not.toMatch(/phone|contact|user_id|catalog_origin|technicianId/);
  });

  it("denies absent, mismatched or edited imported source labels", () => {
    expect(findWordPressOriginalAliasCandidates([original], [])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([original], [{ ...review, title: "Novo Nome" }])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([original], [{ ...review, wp_post_id: 124 }])).toEqual([]);
  });

  it("does not infer WordPress origin or join by equal names", () => {
    expect(findWordPressOriginalAliasCandidates([{ ...original, source_key: "organic_auth" }], [review])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([original], [{ ...review, source_key: "other" }])).toEqual([]);
  });

  it("excludes demonstrations, employers, invalid IDs and empty labels", () => {
    expect(findWordPressOriginalAliasCandidates([original], [{ ...review, demo_candidate: true }])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([{ ...original, kind: "employer" }], [{ ...review, kind: "employer" }])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([{ ...original, wp_post_id: 0 }], [{ ...review, wp_post_id: 0 }])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([{ ...original, title: "  " }], [{ ...review, title: "  " }])).toEqual([]);
  });

  it("fails closed when either snapshot contains duplicate source identities", () => {
    expect(findWordPressOriginalAliasCandidates([original, original], [review])).toEqual([]);
    expect(findWordPressOriginalAliasCandidates([original], [review, review])).toEqual([]);
  });
});
