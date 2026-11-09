import { describe, expect, it } from "vitest";
import { LEGACY_CLAIM_SUBJECT, formatLegacyClaim, normalizeLegacyReference } from "./legacy-claim";

describe("solicitação de perfil legado", () => {
  it("aceita apenas ID numérico positivo ou URL https dos domínios de origem", () => {
    expect(normalizeLegacyReference(" 1234 ")).toBe("ID WordPress: 1234");
    expect(normalizeLegacyReference("https://encontreumtecnico.com/candidate/joao/?ref=outro"))
      .toBe("URL: https://encontreumtecnico.com/candidate/joao");
    expect(normalizeLegacyReference("https://precisodeumtecnico.com/tecnico/abc/"))
      .toBe("URL: https://precisodeumtecnico.com/tecnico/abc");
  });
  it("rejeita URL externa, http, usuário na URL e referências inválidas", () => {
    for (const value of [
      "", "0", "-2", "000", "abc", "javascript:alert(1)",
      "http://encontreumtecnico.com/a", "https://example.com/a",
      "https://encontreumtecnico.com/", "https://admin@encontreumtecnico.com/a",
      "https://encontreumtecnico.com:8443/a",
    ]) expect(normalizeLegacyReference(value)).toBeNull();
  });
  it("não concede titularidade, autenticação ou publicação no conteúdo", () => {
    const result = formatLegacyClaim("1234", "Minha conta antiga\naguarda revisão");
    expect(LEGACY_CLAIM_SUBJECT).toContain("histórico");
    expect(result).toContain("SOMENTE TRIAGEM");
    expect(result).toContain("ID WordPress: 1234");
    expect(result).toContain("Não vincular ou publicar");
    expect(result).not.toContain("\naguarda revisão");
  });
});
