import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { portalHelpContext } from "./free-search-help";

const home = readFileSync("src/components/home-rich.tsx", "utf8");
const contact = readFileSync("src/routes/contato.tsx", "utf8");
const funnel = readFileSync("src/components/assistance-funnel.tsx", "utf8");
const palette = readFileSync("src/styles.css", "utf8");

describe("Contato do portal apenas pelo funil guiado", () => {
  it("preenche modalidade e origem da Home, sem liberação de telefone", () => {
    const source = portalHelpContext("home");
    expect(source.mode).toBe("managed");
    expect(source.service).toBe("Outro serviço");
    expect(source.initialProblem).toContain("Quero ajuda");
    expect(source.initialProblem).toContain("página inicial");
    expect(home).toContain('openFreeHelp(portalHelpContext("home"))');
    expect(home).toContain("Pedir ajuda ao portal");
    expect(home).not.toMatch(/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i);
    expect(home).not.toContain("9 9745-2053");
  });

  it("abre a central de contato com contexto e preserva caminhos de suporte", () => {
    const source = portalHelpContext("contato");
    expect(source.mode).toBe("managed");
    expect(source.initialProblem).toContain("página de contato");
    expect(portalHelpContext("contato", "privacidade").initialProblem).toContain("privacidade");
    expect(contact).toContain('to="/ajuda-acesso"');
    expect(contact).toContain('to="/area-cliente"');
    expect(contact).toContain('portalHelpContext("contato", "privacidade")');
    expect(contact).not.toMatch(/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i);
    expect(contact).not.toContain("dpo@");
    expect(contact).toContain("pageHead(");
    expect(contact).toContain('"/contato"');
  });

  it("preserva rascunho do atendimento e só oferece WhatsApp após registrar pedido", () => {
    expect(funnel).toContain('restored?.problem || context.initialProblem || ""');
    expect(funnel.indexOf('await supabase.from("contact_messages").insert(lead)')).toBeGreaterThan(0);
    expect(funnel.indexOf('setSavedWhatsAppLead(lead)')).toBeGreaterThan(
      funnel.indexOf('await supabase.from("contact_messages").insert(lead)'),
    );
    expect(funnel).toContain("consent");
  });

  it("deixa o fundo nativo menos luminoso, mantendo cores da interface importada e dark mode", () => {
    const native = palette.slice(palette.indexOf("/* Brand palette (WCAG AA)"));
    expect(native).toContain("--background: oklch(0.935 0.016 247)");
    expect(native).toContain("--card: oklch(0.985 0.005 247)");
    expect(native).toContain("--muted: oklch(0.89 0.016 247)");
    expect(palette).toContain("/* site-import tokens: end */");
    expect(native).toContain(".dark {");
  });
});
