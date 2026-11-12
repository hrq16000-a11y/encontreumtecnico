import { describe, expect, it } from "vitest";
import { changeTechnicianPlace, isDifferentDeclaredMunicipality, needsLocationDraftConfirmation, previewTechnicianAreaSuggestion } from "./technician-place-change";

const form = {
  display_name: "Técnico de QA (somente memória)",
  state_uf: "PR", city: "São José dos Pinhais", base_city_ibge_id: 4125506,
  neighborhood: "Jardim Itália", region: "Costeira", bio: "Um texto rascunhado",
};

describe("Troca de município e UF no cadastro mobile", () => {
  it("confirmar o mesmo município IBGE preserva Jardim Itália e rascunho", () => {
    const next = { state_uf: "PR", city: "Sao Jose dos Pinhais", base_city_ibge_id: 4125506 };
    expect(isDifferentDeclaredMunicipality(form, next)).toBe(false);
    expect(needsLocationDraftConfirmation(form, next)).toBe(false);
    expect(changeTechnicianPlace(form, next)).toMatchObject({
      neighborhood: "Jardim Itália", region: "Costeira", bio: form.bio, display_name: form.display_name,
    });
  });

  it("trocar de município pede confirmação e somente então limpa bairros da cidade anterior", () => {
    const next = { state_uf: "PR", city: "Curitiba", base_city_ibge_id: 4106902 };
    expect(needsLocationDraftConfirmation(form, next)).toBe(true);
    // The caller asks for consent first; this pure function does not modify form.
    const changed = changeTechnicianPlace(form, next);
    expect(form.neighborhood).toBe("Jardim Itália");
    expect(changed).toMatchObject({
      city: "Curitiba", neighborhood: "", region: "", bio: form.bio,
      display_name: form.display_name, base_city_ibge_id: 4106902,
    });
  });

  it("trocar de UF não transporta bairro, nem município IBGE da UF anterior", () => {
    const next = { state_uf: "SC", city: "", base_city_ibge_id: null };
    expect(needsLocationDraftConfirmation(form, next)).toBe(true);
    expect(changeTechnicianPlace(form, next)).toMatchObject({
      state_uf: "SC", city: "", neighborhood: "", region: "", base_city_ibge_id: null,
    });
  });

  it("o primeiro município não apaga bairro digitado antes da escolha", () => {
    const initial = { ...form, state_uf: "PR", city: "", base_city_ibge_id: null };
    const next = { state_uf: "PR", city: "Curitiba", base_city_ibge_id: 4106902 };
    expect(needsLocationDraftConfirmation(initial, next)).toBe(false);
    expect(changeTechnicianPlace(initial, next).neighborhood).toBe("Jardim Itália");
  });

  it("com campos dependentes vazios permite troca livre, sem confirmação", () => {
    const current = { ...form, neighborhood: "", region: "" };
    const next = { state_uf: "SC", city: "Florianópolis", base_city_ibge_id: 4205407 };
    expect(needsLocationDraftConfirmation(current, next)).toBe(false);
    expect(changeTechnicianPlace(current, next).city).toBe("Florianópolis");
  });
  it("GPS manual de SJP para Curitiba invalida IBGE, zera bairros dependentes e exige confirmação", () => {
    const snapshot = JSON.stringify(form);
    const result = previewTechnicianAreaSuggestion(form,
      { uf: "PR", city: "Curitiba", neighborhood: "" }, "manual");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.next).toMatchObject({
      state_uf: "PR", city: "Curitiba", base_city_ibge_id: null,
      neighborhood: "", region: "", bio: form.bio, display_name: form.display_name,
    });
    // Cancelar a confirmação significa descartar a prévia: original intacto.
    expect(JSON.stringify(form)).toBe(snapshot);
  });

  it("GPS manual de PR para SC nunca transporta código de município de PR", () => {
    const result = previewTechnicianAreaSuggestion(form,
      { uf: "SC", city: "Florianópolis", neighborhood: "" }, "manual");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.next).toMatchObject({
      state_uf: "SC", city: "Florianópolis", base_city_ibge_id: null,
      neighborhood: "", region: "",
    });
  });

  it("mesmo município mantém IBGE, Jardim Itália, regiões e todo o rascunho", () => {
    const result = previewTechnicianAreaSuggestion(form,
      { uf: "PR", city: "São José dos Pinhais", neighborhood: "" }, "manual");
    expect(result.requiresConfirmation).toBe(false);
    expect(result.next).toEqual(form);
  });

  it("localização automática não sobrescreve seleção manual nem rascunho", () => {
    const result = previewTechnicianAreaSuggestion(form,
      { uf: "PR", city: "Curitiba", neighborhood: "" }, "automatic");
    expect(result.requiresConfirmation).toBe(false);
    expect(result.next).toBe(form);
  });

  it("primeira sugestão GPS não define IBGE arbitrário e não apaga dados independentes", () => {
    const initial = { ...form, state_uf: "", city: "", neighborhood: "", base_city_ibge_id: null };
    const result = previewTechnicianAreaSuggestion(initial,
      { uf: "PR", city: "Curitiba", neighborhood: "" }, "manual");
    expect(result.requiresConfirmation).toBe(false);
    expect(result.next).toMatchObject({
      state_uf: "PR", city: "Curitiba", base_city_ibge_id: null,
      region: "Costeira", bio: form.bio,
    });
  });

});
