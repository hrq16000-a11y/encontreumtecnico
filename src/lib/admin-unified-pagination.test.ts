import { describe, expect, it } from "vitest";
import {
  categoryKeyword, unifiedPageCount, unifiedPageSlice, UNIFIED_DIRECTORY_PAGE_SIZE,
} from "./admin-unified-pagination";

describe("paginação do diretório único", () => {
  it("limita sempre a tela móvel a 18 cartões e permite chegar à última página", () => {
    const rows = Array.from({ length: 755 }, (_, index) => index);
    expect(UNIFIED_DIRECTORY_PAGE_SIZE).toBe(18);
    expect(unifiedPageCount(755)).toBe(42);
    expect(unifiedPageSlice(rows, 0)).toEqual(rows.slice(0, 18));
    expect(unifiedPageSlice(rows, 41)).toEqual(rows.slice(738));
    expect(unifiedPageSlice(rows, -100)).toEqual(rows.slice(0, 18));
    expect(unifiedPageCount(0)).toBe(1);
  });

  it("obtém termos de categoria sem depender do DDD ou inventar localização", () => {
    expect(categoryKeyword("TI - Informática")).toBe("info");
    expect(categoryKeyword("Técnico de Redes")).toBe("rede");
    expect(categoryKeyword("  ")).toBe("");
  });
});
