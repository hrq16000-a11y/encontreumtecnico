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

function foldRegistrationSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/** Search the catalog without hiding already-selected categories or changing the draft. */
export function matchingRegistrationCategories<T extends { slug: string; label: string }>(
  categories: readonly T[], selectedSlugs: readonly string[], query: string,
): T[] {
  const term = foldRegistrationSearch(query.trim());
  return categories.filter((category) => selectedSlugs.includes(category.slug)
    || !term || foldRegistrationSearch(`${category.label} ${category.slug}`).includes(term));
}

/** Filter choices by service or specialty name without changing saved selections.
 * A matching specialty shows its services only when that specialty was selected. */
export function matchingRegistrationServices<T extends { slug: string; label: string; category_slug: string }>(
  services: readonly T[], selectedCategories: readonly string[], query: string,
  categories: readonly { slug: string; label: string }[] = [],
): T[] {
  const term = foldRegistrationSearch(query.trim());
  const matchingCategorySlugs = new Set(categories
    .filter((category) => foldRegistrationSearch(`${category.label} ${category.slug}`).includes(term))
    .map((category) => category.slug));
  return services.filter((service) => selectedCategories.includes(service.category_slug) &&
    (!term || foldRegistrationSearch(`${service.label} ${service.slug}`).includes(term)
      || matchingCategorySlugs.has(service.category_slug)));
}

/** Organize active service choices under their catalog specialty without
 * changing selected values or hiding choices from other selected specialties. */
export function groupRegistrationServices<T extends { category_slug: string }>(
  visibleServices: readonly T[],
  categories: readonly { slug: string; label: string }[],
): { categorySlug: string; categoryLabel: string; services: T[] }[] {
  return categories.map((category) => ({
    categorySlug: category.slug,
    categoryLabel: category.label,
    services: visibleServices.filter((service) => service.category_slug === category.slug),
  })).filter((group) => group.services.length > 0);
}

/** Keep selected services visible, even while a search hides their checkboxes.
 * Unknown catalog entries remain removable without silently changing the draft. */
export function selectedRegistrationServices<T extends { slug: string; label: string }>(
  services: readonly T[], selectedSlugs: readonly string[],
): { slug: string; label: string }[] {
  const labels = new Map(services.map((service) => [service.slug, service.label]));
  return [...new Set(selectedSlugs)].map((slug) => ({
    slug, label: labels.get(slug) ?? "Serviço indisponível",
  }));
}

/** Send a failed final review back to the first required field group, without
 * submitting or changing the technician's saved selections. */
export function registrationReviewIssue(
  form: TechnicianRegistrationForm,
  catalog: RegistrationCatalog,
  persistedCity: PersistedTechnicianCity | null = null,
): { step: 1 | 2; message: string } | null {
  const identityError = registrationStepError(1, form, catalog, persistedCity);
  if (identityError) return { step: 1, message: identityError };
  const servicesError = registrationStepError(2, form, catalog);
  return servicesError ? { step: 2, message: servicesError } : null;
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
