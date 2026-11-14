import { describe, expect, it } from "vitest";
import {
  categoryKeyword, unifiedPageCount, unifiedPageSlice, UNIFIED_DIRECTORY_PAGE_SIZE,
} from "./admin-unified-pagination";

describe("diretório único paginado", () => {
  it("limita a 18 cartões e alcança as últimas fichas sem listagem infinita", () => {
    const rows = Array.from({ length: 489 }, (_, index) => index);
    expect(UNIFIED_DIRECTORY_PAGE_SIZE).toBe(18);
    expect(unifiedPageCount(rows.length)).toBe(28);
    expect(unifiedPageSlice(rows, 0)).toEqual(rows.slice(0, 18));
    expect(unifiedPageSlice(rows, 27)).toEqual(rows.slice(486));
    expect(unifiedPageSlice(rows, -2)).toEqual(rows.slice(0, 18));
    expect(unifiedPageCount(0)).toBe(1);
  });

  it("navega especialidades por fragmento sem adivinhar cidades", () => {
    expect(categoryKeyword("TI - Informática")).toBe("info");
    expect(categoryKeyword("Técnico de Redes")).toBe("rede");
    expect(categoryKeyword("")).toBe("");
  });
});
