import { describe, expect, it } from "vitest";
import { suggestLegacyDisplayName } from "./legacy-display-name";

describe("suggestLegacyDisplayName (read-only historical alias)", () => {
  it.each([
    ["almeidathiagosantos5", "Almeida Thiago Santos"],
    ["alexpaixao13", "Alex Paixao"],
    ["alvaroaquinooliveira", "Alvaro Aquino Oliveira"],
    ["adailtondossantos2011", "Adailton dos Santos"],
    ["almeida_thiago_santos5", "Almeida Thiago Santos"],
    ["alex-paixao13", "Alex Paixao"],
    ["alvaro.aquino.oliveira", "Alvaro Aquino Oliveira"],
  ])("suggests a readable full-token name for %s", (raw, expected) => {
    expect(suggestLegacyDisplayName(raw)).toEqual({
      display: expected, original: raw, suggested: true,
    });
  });

  it.each(["abmsinformatica", "alexandremastercore", "alvrobrasil68", "abc42",
    "alex_suporte13", "alex@paixao.com", "alex__paixao13"])(
    "preserves ambiguous or company-like alias %s verbatim", (raw) => {
      expect(suggestLegacyDisplayName(raw)).toEqual({
        display: raw, original: raw, suggested: false,
      });
    });

  it("capitalizes explicit separated words without claiming inference", () => {
    expect(suggestLegacyDisplayName("alvaro aquino oliveira")).toEqual({
      display: "Alvaro Aquino Oliveira",
      original: "alvaro aquino oliveira",
      suggested: false,
    });
  });
});
