import { describe, expect, it } from "vitest";
import { buildSavedLeadWhatsAppUrl } from "./assistance-whatsapp";
import { buildAssistanceLead } from "./assistance-intent";
import { readFileSync } from "node:fs";

const lead = buildAssistanceLead({
  mode: "managed", name: "Ana Teste", email: "ana@example.com",
  service: "CFTV e segurança", when: "Hoje / urgente",
  problem: "Preciso planejar três câmeras na entrada da residência",
  city: "Curitiba", uf: "PR", neighborhood: "Batel",
  sourceGuide: "instalacao-cameras-seguranca-como-planejar",
});
describe("happen-after-save WhatsApp handoff", () => {
  it("gera texto com origem, serviço, urgência, cidade e contato voluntário do cliente", () => {
    expect(lead).toBeTruthy();
    const url = buildSavedLeadWhatsAppUrl(lead!);
    const parsed = new URL(url);
    expect(parsed.hostname).toBe("api.whatsapp.com");
    expect(parsed.searchParams.get("phone")).toBe("5541997452053");
    const text = parsed.searchParams.get("text") || "";
    for (const part of ["Ana Teste", "ana@example.com", "CFTV", "Curitiba", "Batel", "Hoje / urgente", "guias/instalacao-cameras", "registrei"]) {
      expect(text).toContain(part);
    }
    expect(text).not.toContain("payment approved");
  });
  it("não oferece link em artigos nem antes da persistência", () => {
    const article = readFileSync("src/routes/guias.$slug.tsx", "utf8");
    const funnel = readFileSync("src/components/assistance-funnel.tsx", "utf8");
    expect(article).not.toContain("api.whatsapp.com");
    expect(article).not.toContain("wa.me");
    expect(readFileSync("src/components/guide-lead-callout.tsx", "utf8")).toContain("openFreeHelp");
    expect(funnel).toContain("if (requestError) throw requestError;");
    expect(funnel.indexOf("setSavedWhatsAppLead(lead);")).toBeGreaterThan(funnel.indexOf("if (requestError) throw requestError;"));
    expect(funnel).toContain("buildSavedLeadWhatsAppUrl(savedWhatsAppLead)");
    expect(funnel).toContain("Toque em Enviar no WhatsApp");
  });
  it("rejeita entrada incompleta e não confunde consulta com mensagem enviada", () => {
    expect(() => buildSavedLeadWhatsAppUrl({name:"",email:"",subject:"",message:""})).toThrow();
    const url = buildSavedLeadWhatsAppUrl(lead!);
    expect(url).not.toMatch(/status=enviado|delivery=confirmed|contact_entitlement/i);
  });
});
