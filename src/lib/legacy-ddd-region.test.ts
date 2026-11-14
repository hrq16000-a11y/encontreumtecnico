import { describe, expect, it } from "vitest";
import { getApproximateDDDRegion, getLegacyApproximateRegion } from "./legacy-ddd-region";

describe("legacy DDD region from the private backup's sanitized snapshot", () => {
  it("uses regional centers for 11 and 41, never an exact verified city", () => {
    expect(getApproximateDDDRegion("11")).toBe("São Paulo e região (DDD 11)");
    expect(getApproximateDDDRegion("41")).toBe("Curitiba e região (DDD 41)");
    expect(getLegacyApproximateRegion(678)).toBe("São Paulo e região (DDD 11)");
    expect(getLegacyApproximateRegion(4343)).toBe("Curitiba e região (DDD 41)");
  });

  it("does not invent a city for other regional codes", () => {
    expect(getApproximateDDDRegion("55")).toBe("Região do DDD 55 · RS");
    expect(getApproximateDDDRegion("19")).toBe("Região do DDD 19 · SP");
    expect(getLegacyApproximateRegion(427)).toBe("Região do DDD 55 · RS");
  });

  it("does not assign any region without a single reliable DDD", () => {
    expect(getLegacyApproximateRegion(0)).toBeNull();
    expect(getLegacyApproximateRegion(99999999)).toBeNull();
    expect(getApproximateDDDRegion("00")).toBeNull();
    expect(getApproximateDDDRegion("99")).toBe("Região do DDD 99 · MA");
    expect(getApproximateDDDRegion("123")).toBeNull();
  });
});
