import { describe, expect, it } from "vitest";
import { guiafixAdminSourceId, normalizeGuiafixSearch, readGuiafixStaging } from "./guiafix-staging-normalizer";

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
      city: "Paranaguá", uf: "PR", cityIbgeId: 4118204, category: "Técnico de Informática",
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

  it("generates a stable, SQL-compatible identifier for editing a captured technician", () => {
    const key = "PR:paranagua:maria de souza";
    const id = guiafixAdminSourceId(key);
    expect(id).toBe(guiafixAdminSourceId(key));
    expect(id).not.toBe(guiafixAdminSourceId("PR:paranagua:mariana de souza"));
    expect(id).toMatch(/^guiafix:[a-z-]+-[a-f0-9]{8}-[a-f0-9]{8}$/);
    expect(id.length).toBeLessThanOrEqual(120);
    expect(id).not.toMatch(/[0-9]{10,}/);
  });
});
