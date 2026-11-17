import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AdminNavigation: rolagem do menu por tamanho de tela", () => {
  const source = readFileSync("src/components/admin-navigation.tsx", "utf8");

  it("limita a coluna e permite rolagem independente no desktop", () => {
    expect(source).toContain("lg:max-h-[calc(100dvh-7rem)]");
    expect(source).toContain("lg:flex lg:flex-col");
    expect(source).toContain("lg:min-h-0 lg:flex-1 lg:overflow-y-scroll");
    expect(source).not.toContain("lg:overflow-visible");
  });

  it("preserva rolagem mobile e acesso pelo teclado", () => {
    expect(source).toContain("max-h-[65dvh] flex-col overflow-y-auto");
    expect(source).toContain('aria-label="Menu administrativo"');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain("[scrollbar-gutter:stable]");
  });
});
