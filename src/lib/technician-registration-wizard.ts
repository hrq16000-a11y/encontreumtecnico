import { validMunicipality } from "./service-taxonomy";

export type RegistrationStep = 1 | 2 | 3;
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

/** Mobile onboarding validates locally before advancing; only the server RPC
 * can approve/publicly publish a technician, on the final review step. */
export function registrationStepError(
  step: RegistrationStep,
  form: TechnicianRegistrationForm,
  catalog: RegistrationCatalog,
): string | null {
  if (step === 1) {
    if (form.display_name.trim().length < 2 || form.display_name.trim().length > 80) {
      return "Informe seu nome público (entre 2 e 80 caracteres).";
    }
    if (!validMunicipality(form.state_uf, form.city)) {
      return "Selecione a UF e uma cidade válida do catálogo de municípios onde você atende.";
    }
    // The guided live form must contain a chosen official IBGE municipality ID.
    // Older unit-test fixtures may omit this optional field, but DB validation
    // always enforces an official municipality name before publication.
    if ("base_city_ibge_id" in form && (!Number.isInteger(form.base_city_ibge_id)
        || (form.base_city_ibge_id ?? 0) < 1000000)) {
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
