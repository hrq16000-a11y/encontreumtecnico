import { describe, expect, it } from "vitest";
import { pioneerSearchName } from "./pioneer-search-name";

describe("pioneerSearchName: opt-in presentation after R2 eligibility", () => {
  it.each([
    ["almeidathiagosantos5", "Almeida Thiago Santos"],
    ["alexpaixao13", "Alex Paixao"],
    ["alex_paixao13", "Alex Paixao"],
  ])("suggests %s while preserving the full source alias", (alias, expected) => {
    expect(pioneerSearchName(alias, alias)).toEqual({
      display: expected, originalAlias: alias, suggested: true,
    });
  });

  it("does not infer a name without proven WordPress provenance", () => {
    expect(pioneerSearchName("alexpaixao13")).toEqual({
      display: "alexpaixao13", originalAlias: null, suggested: false,
    });
  });

  it("keeps a separated alias unchanged without provenance", () => {
    expect(pioneerSearchName("alex_paixao13")).toEqual({
      display: "alex_paixao13", originalAlias: null, suggested: false,
    });
  });

  it("never overrides a newly declared name", () => {
    expect(pioneerSearchName("Alex Paixão", "alexpaixao13")).toEqual({
      display: "Alex Paixão", originalAlias: null, suggested: false,
    });
  });

  it("leaves ambiguous company aliases unchanged", () => {
    expect(pioneerSearchName("alvrobrasil68", "alvrobrasil68")).toEqual({
      display: "alvrobrasil68", originalAlias: null, suggested: false,
    });
  });

  it("does not apply an extra guess to names already separated", () => {
    expect(pioneerSearchName("Alvaro Aquino Oliveira", "Alvaro Aquino Oliveira")).toEqual({
      display: "Alvaro Aquino Oliveira", originalAlias: null, suggested: false,
    });
  });
});
