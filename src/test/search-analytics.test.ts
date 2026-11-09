import { describe, expect, it } from "vitest";
import { analyticsAllowed, toSearchEvent } from "@/lib/search-analytics";

describe("search analytics privacy", () => {
  it("does not collect when analysis is rejected", () => { expect(analyticsAllowed('{"analytics":false}')).toBe(false); });
  it("does not collect before consent", () => { expect(analyticsAllowed(null)).toBe(false); });
  it("collects when analysis is accepted", () => { expect(analyticsAllowed('{"analytics":true}')).toBe(true); });
  it("records category, real input city and active filters without identity", () => {
    expect(toSearchEvent({ especialidade: "CFTV", cidade: " Curitiba ", regiao: "", resultCount: 3 })).toEqual({ category: "CFTV", city: "Curitiba", region: "", filters: ["especialidade", "cidade"], result_count: 3 });
  });
});