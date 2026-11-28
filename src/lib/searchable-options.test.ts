import { describe, expect, it } from "vitest";
import { rankChoices } from "./searchable-options";

describe("Seletores inteligentes", () => {
  const options = [
    { value: "eletricista", label: "Eletricista", detail: "Manutenção" },
    { value: "tecnico-informatica", label: "Técnico em Informática", keywords: "computador pc notebook" },
    { value: "tecnico-industrial", label: "Técnico Industrial" },
    ...Array.from({ length: 110 }, (_, i) => ({ value: "servico-" + i, label: "Serviço " + i })),
  ];
  it("prioriza correspondência exata e encontra acentos, tokens e sinônimos", () => {
    expect(rankChoices(options, "TECNICO INFORMATICA")[0]?.value).toBe("tecnico-informatica");
    expect(rankChoices(options, "computador")[0]?.value).toBe("tecnico-informatica");
    expect(rankChoices(options, "manutencao")[0]?.value).toBe("eletricista");
    expect(rankChoices(options, "serviço 109")[0]?.value).toBe("servico-109");
  });
  it("limita listas longas, preserva IDs e não inventa opções", () => {
    expect(rankChoices(options, "")).toHaveLength(8);
    expect(rankChoices(options, "servico")).toHaveLength(8);
    expect(rankChoices(options, "inexistente")).toEqual([]);
  });
});
