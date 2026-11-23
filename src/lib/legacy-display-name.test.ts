import { describe, expect, it } from "vitest";
import { publicLegacyDisplayName, suggestLegacyDisplayName } from "./legacy-display-name";

describe("suggestLegacyDisplayName (read-only historical alias)", () => {
  it.each([
    ["almeidathiagosantos5", "Almeida Thiago Santos"],
    ["alexpaixao13", "Alex Paixao"],
    ["alvaroaquinooliveira", "Alvaro Aquino Oliveira"],
    ["adailtondossantos2011", "Adailton dos Santos"],
    ["almeida_thiago_santos5", "Almeida Thiago Santos"],
    ["alex-paixao13", "Alex Paixao"],
    ["alvaro.aquino.oliveira", "Alvaro Aquino Oliveira"],
    ["abmsinformatica", "ABMS Informática"],
    ["alexandremastercore", "Alexandre Mastercore"],
    ["allanoliveiratj", "Allan Oliveira TJ"],
  ])("suggests a readable full-token name for %s", (raw, expected) => {
    expect(suggestLegacyDisplayName(raw)).toEqual({
      display: expected, original: raw, suggested: true,
    });
  });

  it.each(["alvrobrasil68", "abc42",
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

describe("publicLegacyDisplayName (synthetic public-only privacy guard)", () => {
  it.each([
    "alexa@example.test",
    "Maria Costa contato@empresa.com.br",
    "(41) 99999-1234",
    "Suporte +55 (11) 98888-7777",
    "Atendimento 3333-4444",
    "https://exemplo.com/contato",
    "www.exemplo.com.br",
    "wa.me/5541999991234",
    "@perfil_tecnico",
    "Suporte WhatsApp",
    "Empresa site.com",
    "",
  ])("does not expose contact-like imported identifier %s", (raw) => {
    expect(publicLegacyDisplayName(raw)).toEqual({
      display: "Técnico",
      original: null,
      suggested: false,
      initial: "T",
    });
  });

  it("preserves a legitimate full name without claiming it was inferred", () => {
    expect(publicLegacyDisplayName("Ana Costa")).toEqual({
      display: "Ana Costa",
      original: null,
      suggested: false,
      initial: "A",
    });
  });

  it("preserves safe legacy alias suggestions with a non-sensitive source", () => {
    expect(publicLegacyDisplayName("alexpaixao13")).toEqual({
      display: "Alex Paixao",
      original: "alexpaixao13",
      suggested: true,
      initial: "A",
    });
  });
});
