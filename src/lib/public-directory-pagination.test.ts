import { describe, expect, it } from "vitest";
import { collectPublicDirectoryPages, publicDirectoryPage } from "./public-directory-pagination";

describe("paginação global do catálogo público", () => {
  it("inspeciona todas as páginas antes de cortar os resultados", async () => {
    const items = Array.from({ length: 11 }, (_, index) => index);
    const seen: number[] = [];
    const results = await collectPublicDirectoryPages(async (offset, limit) => {
      seen.push(offset);
      return items.slice(offset, offset + limit);
    }, 5, 15);
    expect(seen).toEqual([0, 5, 10]);
    expect(publicDirectoryPage(results, 2, 5)).toEqual([5, 6, 7, 8, 9]);
  });

  it("falha explicitamente se houver registros além do limite, sem ranking parcial", async () => {
    const items = Array.from({ length: 11 }, (_, index) => index);
    await expect(collectPublicDirectoryPages((offset, limit) =>
      Promise.resolve(items.slice(offset, offset + limit)), 5, 10))
      .rejects.toThrow("requires server-side ranking partitioning");
  });

  it("não aceita lote maior que o permitido", async () => {
    await expect(collectPublicDirectoryPages(async () => [1, 2, 3], 2, 10))
      .rejects.toThrow("exceeded page size");
  });
});
