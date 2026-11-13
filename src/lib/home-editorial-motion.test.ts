import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FAQ } from "./faq";

const read = (path: string) => readFileSync(path, "utf8");
const rich = read("src/components/home-rich.tsx");
const home = read("src/routes/index.tsx");
const footer = read("src/components/site-footer.tsx");
const institutional = read("src/components/home-sections.tsx");
const styles = read("src/styles.css");

describe("Home editorial P1 — FAQ, jornadas, institucional e rodapé", () => {
  it("usa FAQ interativo nativo sem perder conteúdo, link e SEO", () => {
    expect(rich).toContain('aria-labelledby="home-faq-title"');
    expect(rich).toContain("FAQ.slice(0, 4).map");
    expect(rich).toContain("<details");
    expect(rich).toContain("<summary");
    expect(rich).toContain("{item.q}");
    expect(rich).toContain("{item.a}");
    expect(rich).toContain('to="/faq"');
    expect(rich).toContain("group-open:rotate-180");
    expect(rich).toContain("motion-reduce:transition-none");
    expect(FAQ.length).toBeGreaterThanOrEqual(4);
    for (const item of FAQ.slice(0, 4)) {
      expect(item.q.length).toBeGreaterThan(8);
      expect(item.a.length).toBeGreaterThan(18);
    }
  });

  it("destaca duas jornadas e conserva login real sem criar cadastro paralelo", () => {
    expect(home).toContain('aria-labelledby="home-journeys-title"');
    expect(home).toContain("Sou Cliente");
    expect(home).toContain("Sou Técnico");
    expect(home).toContain("Criar conta de cliente");
    expect(home).toContain("Criar conta de técnico");
    const start = home.indexOf('aria-labelledby="home-journeys-title"');
    const end = home.indexOf("</PageShell>", start);
    const block = home.slice(start, end);
    expect(block.match(/to="\/entrar"/g)).toHaveLength(2);
    expect(block).toContain('bg-gradient-to-br from-brand-navy');
    expect(block).toContain("eut-card-lift");
    expect(block).toContain("motion-reduce:transform-none");
    // The pre-existing visual assets and the previous help funnel stay intact.
    expect(home).toContain("src={heroImg}");
    expect(home).toContain("src={techImg}");
    expect(home).toContain("<ContactBand />");
  });

  it("preserva a escolha local/nacional sem redirecionamento ou custos inventados", () => {
    const a = institutional.indexOf("export function CanaisDeAtendimento");
    const b = institutional.indexOf("export function FindOneSection", a);
    const section = institutional.slice(a, b);
    expect(section).toContain('href="https://precisodeumtecnico.com/"');
    expect(section).toContain('target="_blank"');
    expect(section).toContain('rel="noopener noreferrer"');
    expect(section).toContain('to="/tecnicos"');
    expect(section).toContain("bg-gradient-to-br from-brand-navy");
    expect(section).toContain("group-hover:translate-x-1");
    expect(section).toContain("motion-reduce:transform-none");
  });

  it("mantém navegação legal, cookies e funil de contato no rodapé renovado", () => {
    for (const route of [
      "/politicas", "/termos", "/privacidade", "/cookies",
      "/pagamentos-e-reembolsos", "/direitos-dos-titulares",
    ]) expect(footer).toContain(route);
    expect(footer).toContain('to="/contato"');
    expect(footer).toContain("Central de ajuda");
    expect(footer).toContain('to="/area-cliente"');
    expect(footer).toContain('to="/area-tecnico"');
    expect(footer).toContain("eut-open-cookie-preferences");
    expect(footer).toContain("bg-gradient-to-br from-brand-navy");
    expect(footer).toContain("motion-reduce:transform-none");
    expect(footer).not.toMatch(/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i);
  });

  it("respeita preferências de movimento e preserva contraste da paleta P0", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".eut-card-lift, .eut-menu-enter");
    expect(styles).toContain("--background: oklch(0.935 0.016 247)");
    expect(styles).toContain("/* site-import tokens: end */");
  });
});
