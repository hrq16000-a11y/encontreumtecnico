import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { reconcileRegistrationSelections, registrationStepError, shouldSubmitTechnicianWizard, type TechnicianRegistrationForm } from "./technician-registration-wizard";

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
  it("permite retirar serviços e categorias desativados sem perder escolhas válidas", () => {
    const previous = {
      specialties: ["redes", "computadores", "categoria-antiga"],
      service_slugs: ["wifi", "formatacao", "servico-antigo", "orfao"],
    };
    expect(reconcileRegistrationSelections(previous, catalog)).toEqual({
      specialties: ["redes", "computadores"], service_slugs: ["wifi", "formatacao"],
    });
    expect(previous.service_slugs).toContain("servico-antigo");
    expect(registrationStepError(2, { ...form, ...previous }, catalog)).toMatch(/catálogo/);
    expect(registrationStepError(2, { ...form, ...reconcileRegistrationSelections(previous, catalog) }, catalog)).toBeNull();
  });
  it("ao retirar uma categoria preserva somente os serviços das categorias restantes", () => {
    expect(reconcileRegistrationSelections({
      specialties: ["computadores"], service_slugs: ["wifi", "formatacao", "invisivel"],
    }, catalog)).toEqual({ specialties: ["computadores"], service_slugs: ["formatacao"] });
  });
  it("bloqueia avanço sem nome, estado ou cidade", () => {
    expect(registrationStepError(1, { ...form, display_name: " " }, catalog)).toMatch(/nome público/);
    expect(registrationStepError(1, { ...form, state_uf: "" }, catalog)).toMatch(/UF/);
    expect(registrationStepError(1, { ...form, city: "" }, catalog)).toMatch(/cidade/);
    expect(registrationStepError(1, form, catalog)).toBeNull();
  });
  it("reabre uma cidade já persistida mesmo se o catálogo IBGE não puder hidratar o ID", () => {
    const editing = { ...form, base_city_ibge_id: null };
    const savedCity = { state_uf: "PR", city: "Curitiba" };
    // Hoje a cidade do banco só volta como texto; exigir um novo ID bloqueia
    // indevidamente a edição de nome/bio/serviços sem mudança de município.
    expect(registrationStepError(1, editing, catalog)).toMatch(/cidade-base/);
    expect(registrationStepError(1, editing, catalog, savedCity)).toBeNull();
    expect(registrationStepError(1, { ...editing, city: "Londrina" }, catalog, savedCity)).toMatch(/cidade-base/);
    expect(registrationStepError(1, { ...editing, state_uf: "SC" }, catalog, savedCity)).toMatch(/cidade-base/);
    expect(registrationStepError(1, editing, catalog, { state_uf: "PR", city: "Londrina" })).toMatch(/cidade-base/);
    expect(registrationStepError(1, { ...editing, city: "" }, catalog, savedCity)).toMatch(/cidade/);
  });
  it("não permite publicar categoria vazia, catálogo indisponível ou serviço sem relação", () => {
    expect(registrationStepError(2, { ...form, specialties: [] }, catalog)).toMatch(/especialidade/);
    expect(registrationStepError(2, form, { ...catalog, catalogLoading: true })).toMatch(/categorias/);
    expect(registrationStepError(2, { ...form, service_slugs: [] }, catalog)).toMatch(/serviço/);
    expect(registrationStepError(2, { ...form, service_slugs: ["formatacao"] }, catalog)).toMatch(/categoria/);
    expect(registrationStepError(2, form, catalog)).toBeNull();
  });
  it("somente a revisão oferece o submit que publica no servidor", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain("Cadastro guiado · Passo {step} de 3");
    expect(route).toContain("step === 1 && (");
    expect(route).toContain("step === 2 && (");
    expect(route).toContain("step === 3 && (");
    expect(route).toContain('key="wizard-continue" type="button"');
    expect(route).toContain('key="wizard-publish" type="submit" data-wizard-action="publish"');
    expect(route).toContain('shouldSubmitTechnicianWizard(step, submitter?.dataset["wizardAction"] ?? null)');
    expect(route).toContain('type="submit"');
    expect(route).toContain('activationDb.rpc("eut_publish_my_technician"');
    expect(route).toContain("registrationStepError(1, form, catalog, persistedCity)");
    expect(route).toContain("registrationStepError(2, form, catalog)");
    expect(route).toContain('onClick={() => toggleCategory(c.slug)}');
    expect(route).toContain("Remover opções indisponíveis");
    expect(route).toContain("persistedCityRef.current = { ownerId: owner, state_uf: loadedForm.state_uf, city: loadedForm.city }");
    expect(route).toContain('role="progressbar"');
    expect(route).toContain('bottom-[calc(3.5rem+env(safe-area-inset-bottom))]');
    // The old mixed accordion was replaced by separate protected workspaces.
    expect(route).toContain('panelTab === "solicitacoes"');
    expect(route).toContain('<TechnicianDirectRequests userId={user.id} />');
    expect(route).toContain('panelTab === "configuracoes"');
    expect(route).toContain('<TechnicianPrivateContact userId={user.id} />');
    expect(route).toContain("Já tinha cadastro no portal antigo? Recuperar meus dados");
  });

  it("permite voltar diretamente da revisão aos dados ou serviços sem publicar", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    const review = route.split("{step === 3 && (")[1]?.split("<TechnicianEmailOtpVerification")[0] ?? "";
    expect(review).toContain('type="button" onClick={() => moveToStep(1)}');
    expect(review).toContain('type="button" onClick={() => moveToStep(2)}');
    expect(review).toContain("Editar dados");
    expect(review).toContain("Editar serviços");
    expect(route).toContain("writeDraft(form, next)");
  });

  it("permite navegar pelo checklist entre as etapas sem submeter ou perder o rascunho", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    const checklist = route.split('aria-label="Checklist do perfil profissional"')[1]?.split("</ul>")[0] ?? "";
    expect(route).toContain('{ step: 1, label: "Nome e município"');
    expect(route).toContain('{ step: 2, label: "Especialidades e serviços"');
    expect(route).toContain('{ step: 3, label: "Apresentação profissional"');
    expect(checklist).toContain('type="button"');
    expect(checklist).toContain('onClick={() => moveToStep(item.step)}');
    expect(checklist).toContain('aria-current={step === item.step ? "step" : undefined}');
    expect(route).toContain("writeDraft(form, next)");
  });

  it("exige intenção explícita de publicar; navegar ou pressionar Enter cedo não publica", () => {
    expect(shouldSubmitTechnicianWizard(1, null)).toBe(false);
    expect(shouldSubmitTechnicianWizard(2, "publish")).toBe(false);
    expect(shouldSubmitTechnicianWizard(3, null)).toBe(false);
    expect(shouldSubmitTechnicianWizard(3, "continue")).toBe(false);
    expect(shouldSubmitTechnicianWizard(3, "publish")).toBe(true);
  });

  it("etapa de revisão ainda exige consistência de localidade e serviços", () => {
    expect(registrationStepError(3, form, catalog)).toBeNull();
    expect(registrationStepError(3, { ...form, specialties: ["invalid"] }, catalog)).toMatch(/catálogo/);
  });
});
