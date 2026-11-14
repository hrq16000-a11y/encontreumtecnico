/** Administrative catalog edits contain no phone, payment or identity credentials. */
export type CatalogCity = { id: number; name: string; uf: string };
export type CatalogCategory = { slug: string; active: boolean };
export type CatalogService = { slug: string; category_slug: string; active: boolean };
export type CatalogEditDraft = {
  technicianId: string;
  expectedUpdatedAt: string;
  technicianStatus: string;
  previousCity: string;
  previousUf: string | null;
  existingCoverage: number[];
  city: CatalogCity | null;
  specialties: string[];
  serviceSlugs: string[];
  replaceCoverage: boolean;
  reason: string;
};
export type CatalogEditPayload = {
  _technician_id: string;
  _expected_updated_at: string;
  _city_ibge_id: number;
  _specialties: string[];
  _service_slugs: string[];
  _coverage_city_ids: number[];
  _reason: string;
};
export type CatalogEditResult = { ok: true; payload: CatalogEditPayload; coverageReplaced: boolean } |
  { ok: false; issue: string };

const CONTACT = /(?:@|https?:\/\/|www\.|wa\.me|(?:\+?\d[\d\s().-]{8,}\d))/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function prepareAdminCatalogEdit(
  draft: CatalogEditDraft,
  activeCategories: readonly CatalogCategory[],
  activeServices: readonly CatalogService[],
): CatalogEditResult {
  if (!UUID.test(draft.technicianId) || !Number.isFinite(Date.parse(draft.expectedUpdatedAt)))
    return { ok: false, issue: "Cadastro sem identificador ou versão válida. Atualize a página." };
  if (!draft.city || !Number.isInteger(draft.city.id) || draft.city.id < 1000000 ||
      !/^[A-Z]{2}$/.test(draft.city.uf) || !draft.city.name.trim())
    return { ok: false, issue: "Escolha município oficial com código IBGE." };
  const reason = draft.reason.trim();
  if (reason.length < 8 || reason.length > 400 || CONTACT.test(reason))
    return { ok: false, issue: "Justificativa obrigatória de 8 a 400 caracteres, sem contatos." };
  const specialties = [...new Set(draft.specialties)];
  if (specialties.length !== draft.specialties.length || specialties.length < 1 || specialties.length > 30 ||
      specialties.some((slug) => !activeCategories.some((entry) => entry.active && entry.slug === slug)))
    return { ok: false, issue: "Selecione especialidades ativas, sem repetições." };
  const services = [...new Set(draft.serviceSlugs)];
  if (services.length !== draft.serviceSlugs.length || services.length > 64 ||
      services.some((slug) => !activeServices.some((entry) => entry.active && entry.slug === slug &&
        specialties.includes(entry.category_slug))))
    return { ok: false, issue: "Revise os serviços: somente ativos e vinculados às especialidades escolhidas." };

  let coverage = [...draft.existingCoverage];
  const approved = draft.technicianStatus === "aprovado";
  if (!approved && coverage.length > 0)
    return { ok: false, issue: "Perfil não aprovado com cobertura histórica. Revise o cadastro antes de alterar." };
  if (!approved) coverage = [];
  const coverageNeedsReplacement = approved && !coverage.includes(draft.city.id);
  if (coverageNeedsReplacement) {
    if (!draft.replaceCoverage)
      return { ok: false, issue: "Confirme a substituição da cobertura pela nova cidade-base." };
    coverage = [draft.city.id];
  }
  if (approved && (coverage.length < 1 || coverage.length > 5 || new Set(coverage).size !== coverage.length))
    return { ok: false, issue: "Cobertura existente inválida. Recarregue antes de salvar." };
  return {
    ok: true,
    coverageReplaced: coverageNeedsReplacement && draft.replaceCoverage,
    payload: {
      _technician_id: draft.technicianId,
      _expected_updated_at: draft.expectedUpdatedAt,
      _city_ibge_id: draft.city.id,
      _specialties: specialties,
      _service_slugs: services,
      _coverage_city_ids: coverage,
      _reason: reason,
    },
  };
}
