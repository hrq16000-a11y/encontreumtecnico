import { describe, expect, it } from "vitest";
import { registrationStepError, type TechnicianRegistrationForm } from "./technician-registration-wizard";

const catalog = {
  categories: [{ slug: "redes" }, { slug: "computadores" }],
  services: [{ slug: "wifi", category_slug: "redes" }, { slug: "formatacao", category_slug: "computadores" }],
  catalogLoading: false, catalogError: false, servicesLoading: false, servicesError: false,
};
const form: TechnicianRegistrationForm = {
  display_name: "Técnico Teste", state_uf: "PR", city: "Curitiba",
  specialties: ["redes"], service_slugs: ["wifi"],
};
describe("Cadastro guiado mobile", () => {
  it("bloqueia avanço sem nome, estado ou cidade", () => {
    expect(registrationStepError(1, { ...form, display_name: " " }, catalog)).toMatch(/nome público/);
    expect(registrationStepError(1, { ...form, state_uf: "" }, catalog)).toMatch(/UF/);
    expect(registrationStepError(1, { ...form, city: "" }, catalog)).toMatch(/cidade/);
    expect(registrationStepError(1, form, catalog)).toBeNull();
  });
  it("não permite publicar categoria vazia, catálogo indisponível ou serviço sem relação", () => {
    expect(registrationStepError(2, { ...form, specialties: [] }, catalog)).toMatch(/especialidade/);
    expect(registrationStepError(2, form, { ...catalog, catalogLoading: true })).toMatch(/categorias/);
    expect(registrationStepError(2, { ...form, service_slugs: [] }, catalog)).toMatch(/serviço/);
    expect(registrationStepError(2, { ...form, service_slugs: ["formatacao"] }, catalog)).toMatch(/categoria/);
    expect(registrationStepError(2, form, catalog)).toBeNull();
  });
  it("etapa de revisão ainda exige consistência de localidade e serviços", () => {
    expect(registrationStepError(3, form, catalog)).toBeNull();
    expect(registrationStepError(3, { ...form, specialties: ["invalid"] }, catalog)).toMatch(/catálogo/);
  });
});
