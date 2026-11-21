import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicTechnicianBioPreview } from "./technician-public-bio-preview";

describe("Prévia segura da apresentação pública no cartão de busca", () => {
  it("mostra primeiro a introdução realmente informada, sem inventar credenciais", () => {
    const bio = "Atendo equipamentos de informática com diagnóstico presencial.\nMinha experiência: Oficinas da região.";
    expect(publicTechnicianBioPreview(bio)).toBe("Atendo equipamentos de informática com diagnóstico presencial.");
  });

  it("usa uma seção declarada quando não existe introdução", () => {
    expect(publicTechnicianBioPreview("Ferramentas e equipamentos: Kit de ferramentas e multímetro."))
      .toBe("Ferramentas: Kit de ferramentas e multímetro.");
    expect(publicTechnicianBioPreview("Minha experiência: \nMinha formação e cursos: "))
      .toBeNull();
  });

  it("não expõe contato, números ou links nem em registros legados", () => {
    for (const bio of [
      "Ligue 41999999999",
      "Atendo por whatsapp",
      "Meu site é www.exemplo.com",
      "Escreva para teste@empresa.com",
      "Minha experiência: 20 anos em manutenção",
    ]) expect(publicTechnicianBioPreview(bio)).toBeNull();
    expect(publicTechnicianBioPreview(null)).toBeNull();
    expect(publicTechnicianBioPreview("  ")).toBeNull();
  });

  it("limita a prévia sem cortar palavras grandes arbitrariamente", () => {
    const bio = "Atendimento em redes, computadores e manutenção preventiva com cuidado dos equipamentos. ".repeat(6);
    const preview = publicTechnicianBioPreview(bio);
    expect(preview).not.toBeNull();
    expect(Array.from(preview!).length).toBeLessThanOrEqual(166);
    expect(preview!.endsWith("…")).toBe(true);
    expect(preview).not.toContain("undefined");
  });

  it("mantém o cartão somente com campos públicos e sem links de contato", () => {
    const card = readFileSync("src/components/technician-search-card.tsx", "utf8");
    expect(card).toContain("publicTechnicianBioPreview(t.bio)");
    expect(card).toContain("Apresentação informada pelo profissional");
    expect(card).not.toContain("t.phone_number");
    expect(card).not.toMatch(/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i);
  });
});
