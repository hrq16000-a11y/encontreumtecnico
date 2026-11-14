import { describe, expect, it } from "vitest";
import { normalizeGuiafixSearch, readGuiafixStaging } from "./guiafix-staging-normalizer";

const source = {
  source_page: "https://guiafix.com.br/paranagua-pr/tecnico-de-informatica",
  city: "Paranaguá", uf: "PR", city_ibge: 4118204,
  category: "tecnico-de-informatica", single_capture_confirmed: true,
  listings: [{ public_name: "Maria de Souza" }, { public_name: "MARIA DE SOUZA" }],
};

describe("guiafix administrator-only quarantined index", () => {
  it("normalizes accents and deduplicates names within the same city", () => {
    expect(normalizeGuiafixSearch("Paranaguá  PR")).toBe("paranagua pr");
    expect(readGuiafixStaging([source])).toEqual([{
      key: "PR:paranagua:maria de souza", name: "Maria de Souza",
      city: "Paranaguá", uf: "PR", category: "Técnico de Informática",
    }]);
  });

  it("rejects contacts, unexpected private fields and unapproved sources", () => {
    const suspicious = { ...source, listings: [
      { public_name: "Maria de Souza", phone: "oculto" },
      { public_name: "user@example.com" },
      { public_name: "Técnico válido" },
    ] };
    expect(readGuiafixStaging([suspicious]).map(x=>x.name)).toEqual(["Técnico válido"]);
    expect(readGuiafixStaging([{ ...source, source_page: "https://example.org/tecnico-de-informatica" }])).toEqual([]);
    expect(readGuiafixStaging([{ ...source, single_capture_confirmed: false }])).toEqual([]);
  });
});
