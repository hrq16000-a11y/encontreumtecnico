import { validMunicipality } from "./service-taxonomy";

export type RegistrationStep = 1 | 2 | 3;
export type PersistedTechnicianCity = { state_uf: string; city: string };
export type TechnicianRegistrationForm = {
  display_name: string;
  state_uf: string;
  city: string;
  base_city_ibge_id?: number | null;
  specialties: string[];
  service_slugs: string[];
};
export type RegistrationCatalog = {
  categories: readonly { slug: string }[];
  services: readonly { slug: string; category_slug: string }[];
  catalogLoading: boolean;
  catalogError: boolean;
  servicesLoading: boolean;
  servicesError: boolean;
};

/** Reconcile a saved wizard draft against the currently active catalog.
 * Only the technician's local selection changes; no server record is written. */
export function reconcileRegistrationSelections(
  form: Pick<TechnicianRegistrationForm, "specialties" | "service_slugs">,
  catalog: Pick<RegistrationCatalog, "categories" | "services">,
): Pick<TechnicianRegistrationForm, "specialties" | "service_slugs"> {
  const activeCategories = new Set(catalog.categories.map((category) => category.slug));
  const specialties = form.specialties.filter((slug) => activeCategories.has(slug));
  const activeServices = new Set(catalog.services
    .filter((service) => specialties.includes(service.category_slug)).map((service) => service.slug));
  return { specialties, service_slugs: form.service_slugs.filter((slug) => activeServices.has(slug)) };
}

/** Navigation is never a publication intent, even if React changes the
 * visible button while a click is being processed. */
export function shouldSubmitTechnicianWizard(step: RegistrationStep, action: string | null): boolean {
  return step === 3 && action === "publish";
}

/** Filter only the visible service choices; never mutate a saved selection. */
export function matchingRegistrationServices<T extends { slug: string; label: string; category_slug: string }>(
  services: readonly T[], selectedCategories: readonly string[], query: string,
): T[] {
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  const term = fold(query.trim());
  return services.filter((service) => selectedCategories.includes(service.category_slug) &&
    (!term || fold(`${service.label} ${service.slug}`).includes(term)));
}

/** Mobile onboarding validates locally before advancing; only the server RPC
 * can approve/publicly publish a technician, on the final review step. */
export function registrationStepError(
  step: RegistrationStep,
  form: TechnicianRegistrationForm,
  catalog: RegistrationCatalog,
  persistedCity: PersistedTechnicianCity | null = null,
): string | null {
  if (step === 1) {
    if (form.display_name.trim().length < 2 || form.display_name.trim().length > 80) {
      return "Informe seu nome público (entre 2 e 80 caracteres).";
    }
    if (!validMunicipality(form.state_uf, form.city)) {
      return "Selecione a UF e uma cidade válida do catálogo de municípios onde você atende.";
    }
    // The RPC persists only the UF/name, not this temporary picker ID. When
    // re-editing a verified server row, do not block a different field just
    // because the official catalog could not rehydrate the unchanged city.
    // A new account or any change of UF/city still needs an official selection.
    const unchangedSavedCity = persistedCity !== null &&
      form.state_uf === persistedCity.state_uf &&
      form.city.trim() === persistedCity.city.trim();
    if ("base_city_ibge_id" in form && (!Number.isInteger(form.base_city_ibge_id)
        || (form.base_city_ibge_id ?? 0) < 1000000) && !unchangedSavedCity) {
      return "Selecione sua cidade-base na lista oficial de municípios.";
    }
    return null;
  }
  if (catalog.catalogLoading || catalog.catalogError || !catalog.categories.length) {
    return "Não foi possível validar as categorias. Tente carregar novamente.";
  }
  if (form.specialties.length === 0) return "Escolha pelo menos uma especialidade.";
  if (form.specialties.some((s) => !catalog.categories.some((c) => c.slug === s))) {
    return "Escolha somente categorias disponíveis no catálogo.";
  }
  if (catalog.servicesLoading || catalog.servicesError) {
    return "Os serviços estão indisponíveis. Tente carregar novamente.";
  }
  if (form.service_slugs.length === 0) return "Escolha pelo menos um serviço específico que você executa.";
  if (form.service_slugs.some((s) =>
    !catalog.services.some((v) => v.slug === s && form.specialties.includes(v.category_slug)))) {
    return "Cada serviço precisa pertencer a uma categoria selecionada e ativa.";
  }
  return null;
}
