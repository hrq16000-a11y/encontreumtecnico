import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminNavigation: rolagem independente do menu", () => {
  const source = readFileSync("src/components/admin-navigation.tsx", "utf8");

  it("limita a altura e exibe rolagem vertical no desktop", () => {
    expect(source).toContain("lg:max-h-[calc(100dvh-7rem)]");
    expect(source).toContain("lg:flex lg:flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-scroll");
    expect(source).not.toContain("lg:overflow-visible");
  });

  it("mantém menu móvel rolável e acessível por teclado", () => {
    expect(source).toContain("max-h-[65dvh] flex-col overflow-y-auto");
    expect(source).toContain('aria-label="Menu administrativo"');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("[scrollbar-gutter:stable]");
  });
});
