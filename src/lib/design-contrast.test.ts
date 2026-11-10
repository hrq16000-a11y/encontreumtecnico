import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles.css", "utf8");
const brand = css.slice(css.indexOf("/* Brand palette (WCAG AA)"));
const light = brand.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
const dark = brand.match(/\.dark\s*\{([^}]+)\}/)?.[1] ?? "";

type Lch = [number, number, number];
function token(section: string, name: string): Lch {
  const match = section.match(new RegExp("--" + name + ":\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)"));
  if (!match) throw new Error("Missing semantic color: " + name);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
// OKLCH -> linear sRGB (CSS Color 4), clip into the display gamut, then WCAG 2.x luminance.
function luminance([L, C, H]: Lch): number {
  const a = C * Math.cos(H * Math.PI / 180);
  const b = C * Math.sin(H * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return rgb.reduce((sum, value, i) =>
    sum + Math.min(1, Math.max(0, value)) * [0.2126, 0.7152, 0.0722][i], 0);
}
function ratio(fg: Lch, bg: Lch): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const textPairs = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
] as const;

describe("contraste global EUT — WCAG AA", () => {
  it("mantém conjuntos completos e independentes de cores para ambos os temas", () => {
    expect(brand).toContain("/* Must follow the light :root overrides");
    expect(light.length).toBeGreaterThan(100);
    expect(dark.length).toBeGreaterThan(100);
    expect(brand.indexOf(".dark {")).toBeGreaterThan(brand.indexOf(":root {"));
    expect(css).toContain("/* site-import tokens: end */");
    expect(css).toContain("--site-import-foreground"); // Imported roles retain their own prefixed tokens.
  });
  for (const [theme, section] of [["claro", light], ["escuro", dark]] as const) {
    for (const [foreground, background] of textPairs) {
      it(theme + ": " + foreground + " / " + background + " >= 4.5:1", () => {
        expect(ratio(token(section, foreground), token(section, background))).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(theme + ": primary como texto de link >= 4.5:1", () => {
      expect(ratio(token(section, "primary"), token(section, "background"))).toBeGreaterThanOrEqual(4.5);
    });
    it(theme + ": borda do campo de formulário >= 3:1", () => {
      expect(ratio(token(section, "input"), token(section, "card"))).toBeGreaterThanOrEqual(3);
    });
  }
});
