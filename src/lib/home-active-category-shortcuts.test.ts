import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Read-only source contracts for Home1 navigation. Real browser/mobile
 * interactions require a separate QA session before production release.
 */
const home = readFileSync("src/routes/index.tsx", "utf8");
const hook = readFileSync("src/hooks/use-active-categories.ts", "utf8");
const grid = readFileSync("src/components/home-rich.tsx", "utf8");
const directory = readFileSync("src/lib/technicians.functions.ts", "utf8");

describe("Home1 active category shortcuts", () => {
  it("uses only administrator-active, ordered categories rather than hardcoded labels", () => {
    expect(home).toContain('import { useActiveCategories } from "@/hooks/use-active-categories";');
    expect(home).toContain("categories: activeCategories");
    expect(home).toContain("activeCategories.slice(0, 4).map((category)");
    expect(home).not.toContain("const CHIPS = [");
    expect(hook).toContain('.from("eut_service_categories")');
    expect(hook).toContain('.eq("active", true)');
    expect(hook).toContain('.order("display_order")');
    expect(hook).toContain("setCategories(queryError ? [] : (data ?? []))");
    expect(home).toContain("{category.label}");
    expect(home).toContain("<CategoryGrid categories={activeCategories} />");
    expect(grid).toContain("CategoryGrid({ categories }");
    expect(grid).not.toContain("useActiveCategories()");
  });

  it("links each real slug to public filtered search with the existing region", () => {
    const shortcuts = home.slice(home.indexOf('aria-label="Buscar por categoria"'));
    expect(shortcuts).toContain('to="/tecnicos"');
    expect(shortcuts).toContain("especialidade: category.slug");
    expect(shortcuts).toContain("cidade: city.trim()");
    expect(shortcuts).toContain("uf: locationUf, bairro: locationNeighborhood");
    expect(shortcuts).toContain('prioridade: locationUf ? "regiao" : ""');
    expect(shortcuts).toContain("CATEGORY_CHIP_ICONS[category.slug as keyof typeof CATEGORY_CHIP_ICONS] ?? Search");
    expect(shortcuts).toContain("min-h-11");
    expect(directory).toContain('.eq("status", "aprovado")');
    expect(directory).toContain('.eq("active", true)');
    expect(directory).toContain('q.contains("service_slugs", [data.servico])');
    expect(shortcuts).not.toMatch(/\b(?:wa\.me|tel:|mailto:)\b/i);
  });
});
