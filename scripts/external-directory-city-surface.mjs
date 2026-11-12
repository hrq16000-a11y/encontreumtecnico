/**
 * Offline presentation contract for Home, category and service surfaces.
 * Never imported into the public app. Nothing here authorizes rendering in
 * production. Only caller-confirmed COMPLETE synthetic fixture sets can
 * produce a preview; partial/unavailable sources fail closed.
 *
 * City IBGE is the primary key; DDD is a secondary APPROXIMATE region signal
 * supplied by a separately validated city/DDD reference. Never equate a
 * telephone area with coverage, residence, route, activity or service.
 */
import { previewCityDiscovery } from "./external-directory-city-discovery.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SURFACES = new Set(["home", "category", "service"]);
const STATES = new Set(["loading", "unavailable", "fixture_complete"]);

const validSlug = value => typeof value === "string"
  && value.length <= 80 && SLUG.test(value);

const validUtc = value => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  && !Number.isNaN(Date.parse(value));

/**
 * Expected inputs are synthetic or fully authorized eligible catalogue
 * projections, NOT raw WordPress/GuiaFix snapshots.
 *   context: "home" | "category" | "service"
 *   categorySlug: required in category; serviceSlug: required in service
 *   state: "loading" | "unavailable" | "fixture_complete"
 *   sourceExhaustive / municipalEvidenceChecked / areaMappingChecked:
 *       independent proof gates; a claim from a partial list is prohibited.
 *   referenceTime: optional UTC instant to label profile changes as recent.
 * Output is ALWAYS offline and is NEVER a permission to publish.
 */
export function previewCitySurface({
  context = "home", records = [], cityIbgeId, cityLabel,
  regionDdds = [], categorySlug = null, serviceSlug = null,
  state = "unavailable", sourceExhaustive = false,
  municipalEvidenceChecked = false, areaMappingChecked = false,
  referenceTime = null, page = 1, pageSize = 12,
} = {}) {
  if (!SURFACES.has(context) || !STATES.has(state) ||
      (context === "category" && !validSlug(categorySlug)) ||
      (context === "service" && !validSlug(serviceSlug)) ||
      (categorySlug != null && !validSlug(categorySlug)) ||
      (serviceSlug != null && !validSlug(serviceSlug)) ||
      !Array.isArray(records) || records.length > 10000 ||
      (referenceTime !== null && !validUtc(referenceTime))) {
    throw Error("Contrato de exposição por cidade inválido");
  }
  // For category/service, an explicitly declared matching taxonomy is
  // necessary; a public profile's general existence proves no specialty.
  const scoped = context === "home" ? records : records.filter(record => {
    if (context === "category") return Array.isArray(record?.declaredCategorySlugs)
      && record.declaredCategorySlugs.includes(categorySlug);
    return Array.isArray(record?.declaredServiceSlugs)
      && record.declaredServiceSlugs.includes(serviceSlug);
  });

  // No assumptions about a missing city, source outage or truncated list.
  const ready = state === "fixture_complete"
    && sourceExhaustive === true && municipalEvidenceChecked === true;
  const base = {
    context, state: ready ? "fixture_ready" : state === "fixture_complete"
      ? "insufficient_evidence" : state,
    public_integration_authorized: false,
    cta: Object.freeze({ kind: "existing_help_request_funnel", href: null }),
    verified_counts: false,
    declared_count: null,
    approximate_ddd_count: null,
    sections: Object.freeze([]),
  };
  if (!ready) {
    return Object.freeze({
      ...base,
      fallback: state === "loading"
        ? "Consultando informações da cidade selecionada."
        : state === "unavailable"
        ? "Não foi possível consultar profissionais desta região agora. Você pode solicitar atendimento."
        : "Ainda não há dados completos e validados para apresentar profissionais desta cidade.",
    });
  }

  // DDD-only evidence is completely excluded until a trusted city-to-DDD
  // mapping is available. No city is ever inferred from a phone number.
  const result = previewCityDiscovery({
    records: scoped, cityIbgeId, cityLabel,
    regionDdds: areaMappingChecked === true ? regionDdds : [],
    serviceSlug: context === "service" ? serviceSlug : null,
    page, pageSize,
  });
  const declared = result.records.filter(x => x.match_kind === "declared_municipality");
  const regional = result.records.filter(x => x.match_kind === "approximate_phone_region");
  const sections = [];
  if (result.declared_count > 0) sections.push(Object.freeze({
    kind: "declared_coverage", heading: result.headings.declared,
    total_count: result.declared_count, cards: Object.freeze(declared),
    count_is_exhaustive: true,
  }));
  if (areaMappingChecked === true && result.approximate_ddd_count > 0) {
    sections.push(Object.freeze({
      kind: "telephone_region_approximate",
      heading: result.headings.approximate,
      total_count: result.approximate_ddd_count, cards: Object.freeze(regional),
      count_is_exhaustive: true,
    }));
  }

  // Recent *profile updates* only. No login, presence or visit inferred.
  // Count/card set here is explicitly limited to the current page.
  if (referenceTime !== null) {
    const now = Date.parse(referenceTime);
    const recent = result.records.filter(row => {
      if (!row.profile_updated_at) return false;
      const delta = now - Date.parse(row.profile_updated_at);
      return delta >= 0 && delta <= 30 * 24 * 60 * 60 * 1000;
    });
    if (recent.length) sections.push(Object.freeze({
      kind: "recent_profile_updates",
      heading: "Perfis atualizados recentemente",
      total_count: null, cards: Object.freeze(recent),
      count_is_exhaustive: false,
    }));
  }

  const fallback = result.total === 0
    ? "Nenhum profissional com cobertura declarada ou indicação regional verificada nos registros elegíveis consultados. Você pode solicitar atendimento."
    : result.declared_count === 0
    ? "Sem cobertura municipal declarada nos registros elegíveis consultados; as indicações por DDD são apenas regionais."
    : null;
  return Object.freeze({
    ...base, state: "fixture_ready", city_ibge_id: result.city_ibge_id,
    city_label: result.city_label, verified_counts: true,
    declared_count: result.declared_count,
    approximate_ddd_count: areaMappingChecked === true
      ? result.approximate_ddd_count : null,
    total: result.total, page: result.page, page_size: result.page_size,
    has_next_page: result.has_next_page,
    sections: Object.freeze(sections),
    fallback,
  });
}
