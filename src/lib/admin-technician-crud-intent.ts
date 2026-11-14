/**
 * Preparation only: these functions never contact Supabase, grant privileges, or
 * persist changes. An audited server RPC is required before any "Save" button.
 */
export type AdminCity = { id: number; name: string; uf: string };
export type AdminCategory = { slug: string; active: boolean; label?: string };
export type AdminService = { slug: string; category_slug: string; active: boolean; label?: string };
export type AdminCatalog = {
  cities: AdminCity[]; categories: AdminCategory[]; services: AdminService[];
};
export type AdminGuard = {
  technicianStatus: "aprovado" | "pendente" | "suspenso" | "rejeitado";
  accountBlocked: boolean;
  phoneBlocked: boolean;
};
export type PhoneChange =
  | { kind: "keep" }
  | { kind: "replace"; input: string; allowPaidContact: boolean }
  | { kind: "remove" };
export type AdminEditDraft = {
  technicianId: string;
  expectedUpdatedAt: string;
  reason: string;
  baseCityId: number;
  coverageCityIds: number[];
  radiusKm: number | null;
  neighborhood: string | null;
  categorySlugs: string[];
  serviceSlugs: string[];
  phone: PhoneChange;
};
export type PreparedEdit = {
  kind: "preview_only";
  technicianId: string;
  expectedUpdatedAt: string;
  reason: string;
  changes: {
    city: string; uf: string; baseCityId: number;
    coverageCityIds: number[]; radiusKm: number | null; neighborhood: string | null;
    categorySlugs: string[]; serviceSlugs: string[];
    phone: { kind: "keep" } | { kind: "remove" } |
      { kind: "replace"; e164: string; allowPaidContact: boolean };
  };
  auditPreview: {
    cityChanged: "pending_server_comparison";
    coverageCityCount: number;
    serviceCount: number;
    phoneChanged: boolean;
    phoneLast4: string | null;
    keepsExistingBlocks: true;
  };
};
export type PrepareResult = { ok: true; value: PreparedEdit } |
  { ok: false; issues: string[] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_RADIUS = new Set([5, 10, 20, 30, 50, 75, 100, 150, 200, 300]);
const DANGEROUS_CONTACT = /(?:@|https?:\/\/|www\.|wa\.me|(?:\+?\d[\d\s().-]{8,}\d))/i;

export function normalizeBrazilPhoneE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  // A Brazilian area code 55 is valid; distinguish national (10/11 digits) from E.164.
  const normalized = digits.length === 10 || digits.length === 11
    ? "55" + digits : digits.length === 12 || digits.length === 13 ? digits : "";
  // Matches the actual database check constraint.
  return /^55[1-9]{2}[2-9][0-9]{7,8}$/.test(normalized)
    ? "+" + normalized : null;
}

export function prepareAdminTechnicianEdit(
  draft: AdminEditDraft, catalog: AdminCatalog, guard: AdminGuard,
): PrepareResult {
  const issues: string[] = [];
  if (!UUID.test(draft.technicianId)) issues.push("Identificador de técnico inválido.");
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(draft.expectedUpdatedAt) ||
      !Number.isFinite(Date.parse(draft.expectedUpdatedAt)))
    issues.push("A revisão do registro está ausente ou inválida.");
  const reason = draft.reason.trim();
  if (reason.length < 8 || reason.length > 400 || DANGEROUS_CONTACT.test(reason))
    issues.push("Motivo obrigatório (8–400 caracteres), sem contatos, links ou números privados.");
  const city = catalog.cities.find(c => c.id === draft.baseCityId &&
    Number.isInteger(c.id) && /^[A-Z]{2}$/.test(c.uf) && c.name.length > 0);
  if (!city) issues.push("Selecione a cidade-base por código do catálogo oficial IBGE.");
  const coverage = draft.coverageCityIds;
  const distinctCities = new Set(coverage);
  if ((guard.technicianStatus === "aprovado" && (coverage.length < 1 || coverage.length > 5)) ||
      (guard.technicianStatus !== "aprovado" && coverage.length !== 0) ||
      distinctCities.size !== coverage.length ||
      coverage.some(id => !Number.isInteger(id) || !catalog.cities.some(c => c.id === id)))
    issues.push("Selecione de uma a cinco cidades oficiais, sem repetições.");
  if (city && guard.technicianStatus === "aprovado" && !distinctCities.has(city.id))
    issues.push("A cidade-base precisa integrar a cobertura.");
  if (guard.technicianStatus !== "aprovado" && draft.radiusKm !== null)
    issues.push("Raio de atendimento requer perfil aprovado.");
  if (draft.radiusKm !== null && !VALID_RADIUS.has(draft.radiusKm))
    issues.push("Selecione um raio permitido pelo banco.");
  const neighborhood = draft.neighborhood?.trim() || null;
  if (neighborhood && (neighborhood.length < 2 || neighborhood.length > 100 ||
      DANGEROUS_CONTACT.test(neighborhood)))
    issues.push("Bairro inválido ou contendo contato privado.");
  const categories = new Set(draft.categorySlugs);
  if (draft.categorySlugs.length === 0 || draft.categorySlugs.length > 30 ||
      categories.size !== draft.categorySlugs.length ||
      draft.categorySlugs.some(slug => !catalog.categories.some(c => c.slug === slug && c.active)))
    issues.push("Escolha especialidades únicas e ativas no catálogo.");
  const services = new Set(draft.serviceSlugs);
  if (draft.serviceSlugs.length > 64 || services.size !== draft.serviceSlugs.length ||
      draft.serviceSlugs.some(slug => !catalog.services.some(s =>
        s.slug === slug && s.active && categories.has(s.category_slug))))
    issues.push("Selecione até 64 serviços ativos das especialidades escolhidas, sem duplicatas.");
  let phone: PreparedEdit["changes"]["phone"] = { kind: "keep" };
  if (draft.phone.kind === "replace") {
    const normalized = normalizeBrazilPhoneE164(draft.phone.input);
    if (!normalized) issues.push("Informe telefone válido com DDD brasileiro.");
    if (draft.phone.allowPaidContact && (guard.accountBlocked || guard.phoneBlocked))
      issues.push("Conta ou telefone bloqueado não pode habilitar divulgação.");
    if (normalized) phone = {
      kind: "replace", e164: normalized,
      allowPaidContact: draft.phone.allowPaidContact && !guard.accountBlocked && !guard.phoneBlocked,
    };
  } else if (draft.phone.kind === "remove") {
    phone = { kind: "remove" };
  }
  if (issues.length || !city) return { ok: false, issues };
  return {
    ok: true,
    value: {
      kind: "preview_only",
      technicianId: draft.technicianId, expectedUpdatedAt: draft.expectedUpdatedAt, reason,
      changes: {
        city: city.name, uf: city.uf, baseCityId: city.id,
        coverageCityIds: [...coverage], radiusKm: draft.radiusKm,
        neighborhood, categorySlugs: [...draft.categorySlugs],
        serviceSlugs: [...draft.serviceSlugs], phone,
      },
      auditPreview: {
        cityChanged: "pending_server_comparison", coverageCityCount: coverage.length,
        serviceCount: draft.serviceSlugs.length, phoneChanged: phone.kind !== "keep",
        phoneLast4: phone.kind === "replace" ? phone.e164.slice(-4) : null,
        keepsExistingBlocks: true,
      },
    },
  };
}

export type ArchiveDraft = {
  technicianId: string;
  expectedUpdatedAt: string;
  reason: string;
  action: "archive" | "restore";
  isArchived: boolean;
  accountBlocked: boolean;
  phoneBlocked: boolean;
};

export function prepareReversibleArchive(draft: ArchiveDraft):
  { ok: true; kind: "preview_only"; operation: "archive" | "restore"; willPublish: false; preservesBan: true } |
  { ok: false; issue: string } {
  if (!UUID.test(draft.technicianId) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(draft.expectedUpdatedAt) ||
      !Number.isFinite(Date.parse(draft.expectedUpdatedAt)))
    return { ok: false, issue: "Identificador ou revisão inválidos." };
  if (draft.reason.trim().length < 8 || draft.reason.trim().length > 400 ||
      DANGEROUS_CONTACT.test(draft.reason))
    return { ok: false, issue: "Justificativa administrativa inválida." };
  if (draft.action === "archive" && draft.isArchived)
    return { ok: false, issue: "Registro já arquivado." };
  if (draft.action === "restore" && !draft.isArchived)
    return { ok: false, issue: "Registro não está arquivado." };
  // Restoring an archive is NOT approval, unban, contact authorization or publication.
  return {
    ok: true, kind: "preview_only", operation: draft.action,
    willPublish: false, preservesBan: true,
  };
}
