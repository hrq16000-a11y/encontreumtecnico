import { beforeEach, describe, expect, it } from "vitest";
import { clearPendingFilter, readPendingFilter, savePendingFilter } from "./pending-search-filter";
beforeEach(() => sessionStorage.clear());
describe("pending search filter protects last keystroke", () => {
  it("recovers unfinished city after navigation, but never overrides a different URL", () => {
    expect(savePendingFilter("filtro-cidade", "", "São José dos Pinhais", sessionStorage, 100000)).toBe(true);
    expect(readPendingFilter("filtro-cidade", "", sessionStorage, 100000)).toBe("São José dos Pinhais");
    expect(readPendingFilter("filtro-cidade", "Curitiba", sessionStorage, 100000)).toBeNull();
  });
  it("separates city, neighborhood and region and clears after commit", () => {
    savePendingFilter("filtro-bairro", "", "Centro", sessionStorage);
    expect(readPendingFilter("filtro-regiao", "", sessionStorage)).toBeNull();
    clearPendingFilter("filtro-bairro", sessionStorage);
    expect(readPendingFilter("filtro-bairro", "", sessionStorage)).toBeNull();
  });
  it("expires and refuses private or oversized field IDs", () => {
    expect(savePendingFilter("filtro-senha", "", "secret", sessionStorage)).toBe(false);
    expect(savePendingFilter("filtro-cidade", "", "a".repeat(121), sessionStorage)).toBe(false);
    savePendingFilter("filtro-cidade", "", "Pinhais", sessionStorage, 100000);
    expect(readPendingFilter("filtro-cidade", "", sessionStorage, 100000 + 46 * 60 * 1000)).toBeNull();
  });
});
