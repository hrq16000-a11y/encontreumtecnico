import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { getPublicCategoryIllustration, PUBLIC_CATEGORY_ILLUSTRATIONS } from "./public-category-visuals";

describe("Home1 original category imagery", () => {
  it("only references existing small first-party illustrations without scripts", () => {
    for (const [slug, path] of Object.entries(PUBLIC_CATEGORY_ILLUSTRATIONS)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(path).toMatch(/^\/(guias|servicos)\/[a-z0-9-]+\.svg$/);
      expect(existsSync("public" + path)).toBe(true);
      const asset = readFileSync("public" + path, "utf8");
      expect(asset).toContain("<title");
      expect(asset).toContain("<desc");
      expect(asset).not.toMatch(/<script|\bonload=/i);
      expect(Buffer.byteLength(asset)).toBeLessThan(15000);
    }
  });

  it("uses a generic icon for unknown or dynamically added categories", () => {
    expect(getPublicCategoryIllustration("categoria-nova")).toBeNull();
    expect(getPublicCategoryIllustration("../assets/private")).toBeNull();
    expect(getPublicCategoryIllustration("cftv")).toBe("/guias/cftv-planejamento-ilustrado.svg");
  });

  it("preserves active catalog, protected searches, and readable actions on touch", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    const grid = readFileSync("src/components/home-rich.tsx", "utf8");
    expect(home).toContain("activeCategories.slice(0, 4)");
    expect(home).toContain('<CategoryGrid categories={activeCategories} />');
    expect(home).toContain('aria-label="Buscar técnicos por cidade ou região"');
    expect(home).toContain('fetchPriority="high"');
    expect(home).toContain('loading="eager"');
    expect(home).toContain("cidade: city.trim()");
    expect(grid).toContain("getPublicCategoryIllustration(category.slug)");
    expect(grid).toContain('loading="lazy"');
    expect(grid).toContain('width={1200}');
    expect(grid).toContain("motion-safe:group-hover:scale-[1.04]");
    expect(grid).toContain("motion-reduce:transform-none");
    expect(grid).toContain("mt-auto inline-flex min-h-11");
    expect(grid).not.toContain("useActiveCategories()");
    expect(grid).not.toContain('opacity-0 transition-opacity');
    expect(grid).not.toMatch(/wa\.me|tel:|mailto:/);
  });
});
