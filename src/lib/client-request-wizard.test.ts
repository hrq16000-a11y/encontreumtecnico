import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clientRequestCityChanged, clientRequestStepError, type ClientRequestDraft } from "./client-request-wizard";

const draft: ClientRequestDraft = {
  title: "Internet instável",
  description: "Meu roteador perde conexão várias vezes por dia.",
  category: "redes", city: "Curitiba", region: "Centro",
};
const options = ["redes", "computadores"];

describe("Pedido guiado no celular", () => {
  it("exige resumo, descrição e categoria ativa antes de avançar", () => {
    expect(clientRequestStepError(1, { ...draft, title: "WiFi" }, options, false, false, null)).toMatch(/Resuma/);
    expect(clientRequestStepError(1, { ...draft, description: "curto" }, options, false, false, null)).toMatch(/Descreva/);
    expect(clientRequestStepError(1, { ...draft, category: "inativa" }, options, false, false, null)).toMatch(/categoria/);
    expect(clientRequestStepError(1, draft, options, true, false, null)).toMatch(/categoria/);
    expect(clientRequestStepError(1, draft, options, false, false, null)).toBeNull();
  });
  it("exige apenas cidade e permite bairro opcional", () => {
    expect(clientRequestStepError(2, { ...draft, city: " " }, options, false, false, null)).toMatch(/cidade/);
    expect(clientRequestStepError(2, { ...draft, region: "" }, options, false, false, null)).toBeNull();
  });
  it("permite guardar em particular sem selecionar técnico", () => {
    expect(clientRequestStepError(3, draft, options, false, false, null)).toBeNull();
    expect(clientRequestStepError(4, draft, options, false, false, null)).toBeNull();
  });
  it("preserva a gravação privada e a confirmação final no formulário mobile", () => {
    const src = readFileSync("src/routes/area-cliente.tsx", "utf8");
    expect(src).toContain("Solicitação guiada · Passo {step} de 4");
    expect(src).toContain('aria-valuenow={step}');
    expect(src).toContain("step === 1 && (");
    expect(src).toContain("step === 2 && (");
    expect(src).toContain("step === 3 && (");
    expect(src).toContain("step === 4 && (");
    expect(src).toContain("if (step < 4) { advance(); return; }");
    expect(src).toContain('clientRequestStepError(1, form, availableCategories');
    expect(src).toContain('clientRequestStepError(2, form, availableCategories');
    expect(src).toContain('clientRequestStepError(3, form, availableCategories');
    expect(src).toContain('persistClientRequest(');
    expect(src).toContain('eut_share_direct_request');
    expect(src).toContain('checked={shareNow}');
    expect(src).toContain("Nenhuma mensagem é enviada automaticamente");
    expect(src).toContain("Nenhum técnico será avisado.");
    expect(src).toContain("setStep(1)");
    expect(src).toContain("bottom-[calc(3.5rem+env(safe-area-inset-bottom))]");
  });

  it("descarta o técnico após mudança real de cidade, mas não por formatação", () => {
    expect(clientRequestCityChanged("Curitiba", "São José dos Pinhais")).toBe(true);
    expect(clientRequestCityChanged("Curitiba", "")).toBe(true);
    expect(clientRequestCityChanged("", "Curitiba")).toBe(true);
    expect(clientRequestCityChanged("São José dos Pinhais", " sao jose  dos pinhais ")).toBe(false);
    expect(clientRequestCityChanged("Curitiba", " curitiba ")).toBe(false);
    expect(clientRequestCityChanged("Curitiba", "Curitiba")).toBe(false);

    const route = readFileSync("src/routes/area-cliente.tsx", "utf8");
    const update = route.slice(route.indexOf("function updateRequestField("),
      route.indexOf("function chooseTechnicianInWizard("));
    expect(update).toContain('key === "city" && clientRequestCityChanged(form.city, value)');
    expect(update).toContain('key === "category" && value !== form.category');
    expect(update).toContain("clearTechnicianTarget()");
    expect(update).toContain("setTechnicianTarget(null)");
    expect(update).toContain("saveLiveDraft(nextForm, step)");

    const locationStart = route.indexOf("<CustomerLocationButton onLocated=");
    const locationEnd = route.indexOf("}} />", locationStart);
    const locationHandler = route.slice(locationStart, locationEnd);
    expect(locationHandler).toContain("clientRequestCityChanged(form.city, nextForm.city)");
    expect(locationHandler).toContain("clearTechnicianTarget()");
    expect(locationHandler).toContain("setTechnicianTarget(null)");
    expect(locationHandler).toContain("saveLiveDraft(nextForm, step)");
    expect(locationHandler).toContain("setShareNow(false)");
  });

  it("impede compartilhar sem destinatário ou com contato pessoal no texto", () => {
    expect(clientRequestStepError(3, draft, options, false, true, null)).toMatch(/Escolha um técnico/);
    expect(clientRequestStepError(4, { ...draft, description: "Ligue no meu celular 41999990000 para explicar tudo." },
      options, false, true, "selected-id")).toMatch(/Retire/);
    expect(clientRequestStepError(4, draft, options, false, true, "selected-id")).toBeNull();
  });
});
