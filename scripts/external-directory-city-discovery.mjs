/**
 * OFFLINE CITY-FIRST DISCOVERY PREVIEW ONLY.
 * NOT imported by the public site. No network, SQL, Auth, or side effects.
 *
 * Distinguish technician-declared municipality coverage from approximate
 * telephone-area hints. A DDD never proves residence, municipality, distance,
 * availability, login, a service rendered, or service eligibility.
 * The caller must validate IBGE codes and city/DDD mapping against official
 * reference data before any backend/public integration.
 */
import { previewDeclaredRegionalMatch } from "./external-directory-regional-evidence.mjs";

const SAFE_KEY = /^[a-z0-9:_-]{3,130}$/i;
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DDD = /^[1-9][0-9]$/;

const normalizedDate = value => {
  if (value == null) return null;
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
      Number.isNaN(Date.parse(value))) throw Error("Data de atualização inválida");
  return value;
};

export function previewCityDiscovery({
  records, cityIbgeId, cityLabel, regionDdds = [],
  serviceSlug = null, page = 1, pageSize = 20,
} = {}) {
  if (!Array.isArray(records) || records.length > 10000 ||
      !Number.isSafeInteger(cityIbgeId) || cityIbgeId < 1000000 ||
      cityIbgeId > 9999999 || typeof cityLabel !== "string" ||
      !/^[\p{L}\p{M} '-]{2,80}$/u.test(cityLabel.trim()) ||
      !Array.isArray(regionDdds) || regionDdds.length > 10 ||
      regionDdds.some(v => typeof v !== "string" || !DDD.test(v)) ||
      !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50 ||
      (serviceSlug != null && (typeof serviceSlug !== "string" ||
        !SAFE_SLUG.test(serviceSlug) || serviceSlug.length > 80))) {
    throw Error("Parâmetros inválidos de descoberta por cidade");
  }

  const dd = [...new Set(regionDdds)];
  const seen = new Set();
  const matches = [];
  for (const record of records) {
    if (!record || typeof record !== "object" ||
        typeof record.stableKey !== "string" || !SAFE_KEY.test(record.stableKey)) {
      throw Error("Identificador existente inválido");
    }
    // Duplicate identity in different sources must be reconciled, not counted
    // twice or silently hidden in the city widget.
    if (seen.has(record.stableKey)) throw Error("Identidade duplicada exige revisão");
    seen.add(record.stableKey);
    if (record.quarantined === true || record.blocked === true ||
        record.enabled !== true || record.publicEligible !== true ||
        record.published !== true) continue;

    if (serviceSlug !== null &&
        (!Array.isArray(record.declaredServiceSlugs) ||
          !record.declaredServiceSlugs.includes(serviceSlug))) continue;
    const byCity = previewDeclaredRegionalMatch(record, {cityIbgeId});
    const byDDD = dd.some(ddd =>
      previewDeclaredRegionalMatch(record, {ddd}).ddd_match);
    if (!byCity.municipality_match && !byDDD) continue;

    const updated = normalizedDate(record.profileUpdatedAt);
    const title = typeof record.displayName === "string" &&
      record.displayName.trim().length > 0 &&
      record.displayName.trim().length <= 100
      ? record.displayName.trim() : "Profissional com dados mínimos";

    matches.push(Object.freeze({
      stable_key: record.stableKey, // preexisting ID/alias, never generated here
      display_name: title,
      match_kind: byCity.municipality_match
        ? "declared_municipality" : "approximate_phone_region",
      match_label: byCity.municipality_match
        ? "Cobertura municipal declarada"
        : "DDD da região — cobertura municipal não confirmada",
      profile_updated_at: updated,
      // A profile update is NOT last login or recent online presence.
      last_login_at: null,
      availability_confirmed: null,
      distance_km: null,
      service_completed_confirmed: null,
    }));
  }

  // Declared municipality first; dates are only profile updates, never login.
  // Stable identity breaks ties, allowing deterministic multi-page retrieval.
  matches.sort((a, b) =>
    Number(b.match_kind === "declared_municipality") -
      Number(a.match_kind === "declared_municipality") ||
    (b.profile_updated_at ?? "").localeCompare(a.profile_updated_at ?? "") ||
    a.stable_key.localeCompare(b.stable_key));
  const declaredCount = matches.filter(r =>
    r.match_kind === "declared_municipality").length;
  const total = matches.length;
  const start = (page - 1) * pageSize;
  return Object.freeze({
    city_ibge_id: cityIbgeId,
    city_label: cityLabel.trim(),
    declared_count: declaredCount,
    approximate_ddd_count: total - declaredCount,
    total, page, page_size: pageSize,
    has_next_page: start + pageSize < total,
    headings: Object.freeze({
      declared: `Técnicos com cobertura declarada em ${cityLabel.trim()}`,
      approximate: `Profissionais com DDD da região de ${cityLabel.trim()} (cobertura não confirmada)`,
      recent: "Perfis atualizados recentemente", // never "Últimos acessos"
    }),
    records: Object.freeze(matches.slice(start, start + pageSize)),
    public_integration_authorized: false,
  });
}
