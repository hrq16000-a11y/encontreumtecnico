import { describe, expect, it } from "vitest";
import {
  catalogWriteError,
  validateCatalogDraft,
  type CatalogDraft,
} from "./admin-catalog-validation";

const service: CatalogDraft = {
  kind: "service",
  slug: "reparo",
  label: "  Reparo de notebooks  ",
  description: "  Diagnóstico ",
  displayOrder: "12",
  categorySlug: "informatica",
};

describe("validação das edições do catálogo administrativo", () => {
  it("normaliza campos e mantém o identificador fora das alterações", () => {
    expect(validateCatalogDraft(service, ["informatica"])).toEqual({
      changes: {
        label: "Reparo de notebooks",
        description: "Diagnóstico",
        display_order: 12,
        category_slug: "informatica",
      },
      error: null,
    });
  });

  it("recusa serviços em categoria inexistente ou desativada", () => {
    expect(validateCatalogDraft(service, ["eletrica"]).error).toMatch(/categoria ativa/);
  });

  it.each(["-1", "3.5", "abc", "10000", "", "9007199254740993"])(
    "recusa posição inválida %s",
    (displayOrder) => {
      expect(
        validateCatalogDraft({ ...service, displayOrder }, ["informatica"]).error,
      ).toBeTruthy();
    },
  );

  it("valida nomes e descrições sem alterar os dados originais", () => {
    const category: CatalogDraft = {
      ...service,
      kind: "category",
      label: "TI",
      description: "x".repeat(501),
    };
    expect(validateCatalogDraft(category, []).error).toMatch(/nome/);
    expect(validateCatalogDraft({ ...category, label: "Informática" }, []).error).toMatch(
      /descrição/,
    );
    expect(
      validateCatalogDraft({ ...category, label: "Informática", description: "" }, []),
    ).toEqual({
      changes: { label: "Informática", description: "", display_order: 12 },
      error: null,
    });
  });

  it("não anuncia sucesso quando a escrita não devolve a linha esperada", () => {
    expect(catalogWriteError("categoria", { data: null, error: null })).toMatchObject({
      message: expect.any(String),
    });
    expect(catalogWriteError("categoria", { data: { slug: "outra" }, error: null })).toBeTruthy();
    expect(catalogWriteError("categoria", { data: { slug: "categoria" }, error: null })).toBeNull();
  });
});
