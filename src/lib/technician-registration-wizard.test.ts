import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchingRegistrationCategories, matchingRegistrationServices, groupRegistrationServices, selectedRegistrationServices, reconcileRegistrationSelections, registrationReviewIssue, registrationStepError, shouldSubmitTechnicianWizard, type TechnicianRegistrationForm } from "./technician-registration-wizard";

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
  it("busca especialidades sem acentos e mantém as já selecionadas acessíveis", () => {
    const available = [
      { slug: "informatica", label: "Informática" },
      { slug: "eletrica", label: "Instalações elétricas" },
      { slug: "celulares", label: "Conserto de celulares" },
    ];
    const selected = ["eletrica"];
    expect(matchingRegistrationCategories(available, selected, "INFORMATICA").map((item) => item.slug))
      .toEqual(["informatica", "eletrica"]);
    expect(matchingRegistrationCategories(available, selected, "celular").map((item) => item.slug))
      .toEqual(["eletrica", "celulares"]);
    expect(matchingRegistrationCategories(available, [], "instalacoes").map((item) => item.slug))
      .toEqual(["eletrica"]);
    expect(matchingRegistrationCategories(available, [], "radio")).toEqual([]);
    expect(matchingRegistrationCategories(available, selected, "")).toEqual(available);
    expect(selected).toEqual(["eletrica"]);
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain('id="eut-wizard-category-search"');
    expect(route).toContain("visibleCategories.map((c)");
    expect(route).toContain('onClick={() => setCategoryQuery("")}');
    expect(route).toContain('onClick={() => toggleCategory(c.slug)}');
  });
  it("agrupa serviços por especialidade sem alterar escolhas ou a ordem do catálogo", () => {
    const choices = [
      { slug: "wifi", category_slug: "redes", label: "Rede Wi-Fi" },
      { slug: "notebook", category_slug: "computadores", label: "Notebook" },
      { slug: "cabos", category_slug: "redes", label: "Cabeamento" },
    ];
    const categories = [
      { slug: "computadores", label: "Computadores" },
      { slug: "redes", label: "Redes" },
      { slug: "eletrica", label: "Elétrica" },
    ];
    expect(groupRegistrationServices(choices, categories)).toEqual([
      { categorySlug: "computadores", categoryLabel: "Computadores", services: [choices[1]] },
      { categorySlug: "redes", categoryLabel: "Redes", services: [choices[0], choices[2]] },
    ]);
    expect(groupRegistrationServices(choices.filter((service) => service.slug === "cabos"), categories))
      .toEqual([{ categorySlug: "redes", categoryLabel: "Redes", services: [choices[2]] }]);
    expect(choices.map((service) => service.slug)).toEqual(["wifi", "notebook", "cabos"]);
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain("groupRegistrationServices(visibleServices, categories).map((group)");
    expect(route).toContain('aria-label={`Serviços de ${group.categoryLabel}`}');
    expect(route).toContain("group.services.map((service)");
    expect(route).toContain("form.service_slugs.includes(service.slug)");
  });

  it("mantém serviços selecionados visíveis e removíveis mesmo fora do filtro", () => {
    const available = [{ slug: "wifi", label: "Rede Wi-Fi" }, { slug: "cabos", label: "Cabeamento" }];
    const chosen = ["wifi", "cabos", "inativo", "wifi"];
    expect(selectedRegistrationServices(available, chosen)).toEqual([
      { slug: "wifi", label: "Rede Wi-Fi" },
      { slug: "cabos", label: "Cabeamento" },
      { slug: "inativo", label: "Serviço indisponível" },
    ]);
    expect(chosen).toEqual(["wifi", "cabos", "inativo", "wifi"]);
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain('aria-label="Serviços selecionados"');
    expect(route).toContain('aria-label={`Remover serviço: ${service.label}`');
    expect(route).toContain("service_slugs: form.service_slugs.filter((slug) => slug !== service.slug)");
  });
  it("filtra serviços sem acento e preserva as escolhas fora da busca", () => {
    const available = [
      { slug: "rede-wifi", category_slug: "redes", label: "Instalação de Wi-Fi" },
      { slug: "cabos", category_slug: "redes", label: "Cabeamento óptico" },
      { slug: "notebook", category_slug: "computadores", label: "Reparo de notebook" },
    ];
    const chosen = ["rede-wifi", "cabos"];
    expect(matchingRegistrationServices(available, ["redes"], "INSTALACAO").map((item) => item.slug)).toEqual(["rede-wifi"]);
    expect(matchingRegistrationServices(available, ["redes"], "optico").map((item) => item.slug)).toEqual(["cabos"]);
    expect(matchingRegistrationServices(available, ["redes"], "").map((item) => item.slug)).toEqual(chosen);
    expect(matchingRegistrationServices(available, ["redes"], "notebook")).toEqual([]);
    expect(chosen).toEqual(["rede-wifi", "cabos"]);
  });
  it("localiza serviços pela especialidade ativa, mesmo sem termo no nome do serviço", () => {
    const available = [
      { slug: "troca-disjuntor", category_slug: "eletrica", label: "Troca de disjuntor" },
      { slug: "montagem-pc", category_slug: "computadores", label: "Montagem de PC" },
      { slug: "display", category_slug: "celulares", label: "Reparo de display" },
    ];
    const categories = [
      { slug: "eletrica", label: "Instalações elétricas" },
      { slug: "computadores", label: "Informática" },
      { slug: "celulares", label: "Celulares" },
    ];
    const selected = ["eletrica", "computadores"];
    expect(matchingRegistrationServices(available, selected, "INSTALACOES ELETRICAS", categories).map((item) => item.slug))
      .toEqual(["troca-disjuntor"]);
    expect(matchingRegistrationServices(available, selected, "informatica", categories).map((item) => item.slug))
      .toEqual(["montagem-pc"]);
    expect(matchingRegistrationServices(available, selected, "montagem", categories).map((item) => item.slug))
      .toEqual(["montagem-pc"]);
    expect(matchingRegistrationServices(available, selected, "celulares", categories)).toEqual([]);
    expect(matchingRegistrationServices(available, selected, "", categories).map((item) => item.slug))
      .toEqual(["troca-disjuntor", "montagem-pc"]);
    expect(selected).toEqual(["eletrica", "computadores"]);
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain("matchingRegistrationServices(services, form.specialties, serviceQuery, categories)");
    expect(route).toContain("Buscar serviço ou especialidade");
  });
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
    expect(route).toContain('id="eut-wizard-service-search"');
    expect(route).toContain("group.services.map((service)");
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
    const review = route.split("{step === 3 && (")[1] ?? "";
    expect(review).toContain('type="button" onClick={() => moveToStep(1)}');
    expect(review).toContain('type="button" onClick={() => moveToStep(2)}');
    expect(review).toContain("Editar dados");
    expect(review).toContain("Editar serviços");
    expect(route).toContain("writeDraft(form, next)");
  });

  it("não exige OTP adicional nem confirmação de telefone no cadastro publicado", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).not.toContain("TechnicianEmailOtpVerification");
    expect(route).not.toContain("PioneerPhoneVerification");
    expect(route).toContain('activationDb.rpc("eut_publish_my_technician"');
    expect(route).toContain('<TechnicianPrivateContact userId={user.id} />');
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

  it("oferece acesso à ficha publicada somente após confirmação persistida da conta", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    const verified = route.indexOf("technicianPublicationWasPersisted(requested, persisted,");
    const published = route.indexOf("setJustPublishedProfile(persisted.public_slug || persisted.id)");
    const privateDraftCleared = route.indexOf('clearProtectedDraft("tecnico", savingOwner)');
    expect(verified).toBeGreaterThan(0);
    expect(published).toBeGreaterThan(verified);
    expect(published).toBeGreaterThan(privateDraftCleared);
    expect(route).toContain("setJustPublishedProfile(null)");
    expect(route).toContain('step === 3 && currentStatus === "aprovado" && justPublishedProfile');
    expect(route).toContain('<TechnicianPublicProfileLink ownerId={user.id} profileId={profileId}>');
    expect(route).not.toContain('lookup={');
    expect(route).toContain("Abrir meu perfil publicado");
    expect(route).not.toContain("setJustPublishedProfile(form.");
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

  it("devolve a etapa exata que precisa de correção antes de publicar", () => {
    expect(registrationReviewIssue(form, catalog)).toBeNull();
    expect(registrationReviewIssue({ ...form, display_name: "", service_slugs: [] }, catalog))
      .toMatchObject({ step: 1, message: expect.stringMatching(/nome público/) });
    expect(registrationReviewIssue({ ...form, service_slugs: [] }, catalog))
      .toMatchObject({ step: 2, message: expect.stringMatching(/serviço/) });
    expect(registrationReviewIssue({ ...form, base_city_ibge_id: null }, catalog))
      .toMatchObject({ step: 1, message: expect.stringMatching(/cidade-base/) });
    expect(registrationReviewIssue({ ...form, base_city_ibge_id: null }, catalog,
      { state_uf: "PR", city: "Curitiba" })).toBeNull();
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).toContain("moveToStep(reviewIssue.step)");
    expect(route).toContain("setValidationIssue(reviewIssue.message)");
    expect(route).toContain('validationIssue && <p role="alert"');
    expect(route).toContain("writeDraft(form, next)");
  });
});
