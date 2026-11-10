import { describe, expect, it } from "vitest";
import { clientRequestStepError, type ClientRequestDraft } from "./client-request-wizard";

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
  it("impede compartilhar sem destinatário ou com contato pessoal no texto", () => {
    expect(clientRequestStepError(3, draft, options, false, true, null)).toMatch(/Escolha um técnico/);
    expect(clientRequestStepError(4, { ...draft, description: "Ligue no meu celular 41999990000 para explicar tudo." },
      options, false, true, "selected-id")).toMatch(/Retire/);
    expect(clientRequestStepError(4, draft, options, false, true, "selected-id")).toBeNull();
  });
});
