/**
 * OFFLINE CONTRACT TEST DOUBLE, not an endpoint or database adapter.
 * This creates a strictly allowlisted, non-sensitive response for the existing
 * city-first Home/category/service preview. No real server/SSR imports.
 *
 * Evidence booleans are fixture attestations, NOT proof of RLS, real DB
 * completeness, city↔DDD mapping or permission to publish.
 */
import { previewCityRouteIntegration } from "./external-directory-city-surface.mjs";

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRIVATE_IN_NAME = /@|https?:|www\.|wa\.me|[<>]|\+?\d[\d\s().-]{7,}\d/i;
const VALID_SOURCES = new Set(["organic", "admin_manual", "wordpress", "external"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORGANIC_ID_KEY = /^organic:technicians:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function safeName(value) {
  if (typeof value !== "string") return "Profissional com dados mínimos";
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100 || PRIVATE_IN_NAME.test(name))
    return "Profissional com dados mínimos";
  return name;
}
function verifiedPublicPath(row) {
  return row.publicSlugVerified === true &&
    typeof row.publicSlug === "string" &&
    row.publicSlug.length <= 96 && SAFE_SLUG.test(row.publicSlug)
    ? "/tecnicos/" + row.publicSlug : null;
}
const frozenArray = items => Object.freeze(items.map(x => Object.freeze(x)));

/**
 * API response SHAPE only. The future authenticated/sanitized backend must
 * independently establish eligible IDs, exhaustive totals and policy/RLS.
 * The default state returns no records, counts or assertions of availability.
 */
export function previewSanitizedCityBackendResponse({
  routeKey = "home", routeCategorySlug = null,
  records = [], cityIbgeId, cityLabel, regionDdds = [],
  page = 1, pageSize = 12, referenceTime = null,
  state = "unavailable",
  evidence = {},
} = {}) {
  if (!Array.isArray(records) || records.length > 10000 ||
      !evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw Error("Contrato de backend inválido");
  }
  const allowComplete = state === "fixture_complete" &&
    evidence.sourceExhaustive === true &&
    evidence.eligibilityChecked === true &&
    // A complete list of source aliases is not yet a catalogue of unique people.
    evidence.identityReconciliationChecked === true &&
    evidence.authorizedScopeChecked === true &&
    evidence.municipalEvidenceChecked === true;
  // Each eligible record is independently attested in the fixture. An
  // unreviewed imported row cannot be exposed by setting enabled alone.
  const vetted = records.map(record => {
    if (!record || typeof record !== "object" || Array.isArray(record) ||
        typeof record.stableKey !== "string" ||
        !VALID_SOURCES.has(record.sourceKind)) {
      throw Error("Registro de fonte inválido");
    }
    const eligible = record.eligibilityAttested === true &&
      (record.sourceKind !== "external" && record.sourceKind !== "wordpress" ||
        record.sourceReviewed === true) &&
      record.enabled === true && record.publicEligible === true &&
      record.published === true && record.blocked !== true &&
      record.quarantined !== true;
    // Do not spread raw record: no PII or unverified location may propagate.
    return {
      stableKey: record.stableKey,
      enabled: eligible,
      publicEligible: eligible,
      published: eligible,
      blocked: record.blocked === true,
      quarantined: record.quarantined === true,
      displayName: safeName(record.displayName),
      profileUpdatedAt: record.profileUpdatedAt ?? null,
      declaredDdds: eligible ? (record.declaredDdds ?? []) : [],
      declaredCoverageCityIds: eligible ? (record.declaredCoverageCityIds ?? []) : [],
      declaredBaseCityIbgeId: eligible ? (record.declaredBaseCityIbgeId ?? null) : null,
      declaredCategorySlugs: eligible ? (record.declaredCategorySlugs ?? []) : [],
      declaredServiceSlugs: eligible ? (record.declaredServiceSlugs ?? []) : [],
    };
  });
  // Even a fixture attesting reconciliation must not return two eligible
  // aliases with the same verified canonical public profile URL.
  // A name collision alone is NOT proof of shared identity.
  if (allowComplete) {
    const publicPaths = new Set();
    const sourceAliases = new Set();
    const existingTechnicianIds = new Set();
    for (const [index, record] of records.entries()) {
      // Validate all source keys, even those excluded by a route facet.
      if (sourceAliases.has(record.stableKey)) {
        throw Error("Identidade duplicada exige revisão");
      }
      sourceAliases.add(record.stableKey);
      if (vetted[index].enabled !== true) continue;
      // Reuse the explicitly reviewed existing technician reference from the
      // offline identity reconciliation contract, never a name/DDD guess.
      // Also recognize the existing organic UUID already in its source key.
      const suppliedId = record.existing_technician_id ?? null;
      if (suppliedId !== null &&
          (typeof suppliedId !== "string" || !UUID.test(suppliedId))) {
        throw Error("Referência de identidade existente inválida");
      }
      const organicId = record.sourceKind === "organic"
        ? record.stableKey.match(ORGANIC_ID_KEY)?.[1] ?? null : null;
      if (organicId && suppliedId &&
          organicId.toLowerCase() !== suppliedId.toLowerCase()) {
        throw Error("Referências de identidade conflitantes exigem revisão");
      }
      const existingId = (suppliedId ?? organicId)?.toLowerCase() ?? null;
      if (existingId !== null) {
        if (existingTechnicianIds.has(existingId)) {
          throw Error("Identidade canônica duplicada exige reconciliação");
        }
        existingTechnicianIds.add(existingId);
      }
      const path = verifiedPublicPath(record);
      if (path === null) continue;
      if (publicPaths.has(path)) {
        throw Error("Slug público duplicado exige reconciliação de identidade");
      }
      publicPaths.add(path);
    }
  }
  const projectedByKey = new Map(records.map(record => [record.stableKey, record]));
  const view = previewCityRouteIntegration({
    routeKey, routeCategorySlug,
    records: vetted, cityIbgeId, cityLabel, regionDdds,
    page, pageSize, referenceTime, state,
    sourceExhaustive: allowComplete,
    municipalEvidenceChecked: evidence.municipalEvidenceChecked === true,
    areaMappingChecked: evidence.cityDddMappingChecked === true,
  }).preview;

  // The route contract is deliberately not a public route's runtime payload.
  // Every exposed key is explicit. Never expose source keys, raw DDD, contact,
  // source claims, exact addresses, login/online signals or internal IDs.
  const sections = frozenArray(view.sections.map(section => ({
    kind: section.kind,
    heading: section.heading,
    total_count: section.count_is_exhaustive ? section.total_count : null,
    count_is_exhaustive: section.count_is_exhaustive,
    cards: frozenArray(section.cards.map(card => {
      const original = projectedByKey.get(card.stable_key);
      return {
        display_name: card.display_name,
        match_kind: card.match_kind,
        match_label: card.match_label,
        profile_path: original ? verifiedPublicPath(original) : null,
        profile_updated_at: card.profile_updated_at,
      };
    })),
  })));
  const ready = view.verified_counts === true;
  const response = {
    contract: "city-discovery-offline-v1",
    state: view.state,
    public_integration_authorized: false,
    is_real_backend_response: false,
    city: ready ? Object.freeze({ibge_id:view.city_ibge_id,label:view.city_label}) : null,
    totals: ready ? Object.freeze({
      eligible_matches: view.total,
      declared_municipality: view.declared_count,
      approximate_telephone_region: view.approximate_ddd_count,
      exhaustive_in_fixture: true,
    }) : null,
    pagination: ready ? Object.freeze({
      page:view.page,page_size:view.page_size,
      has_next_page:view.has_next_page,
    }) : null,
    sections,
    fallback: view.fallback ?? null,
    cta_kind: "existing_help_request_funnel",
  };
  return Object.freeze(response);
}
