/**
 * Offline-only regional evidence preview for the future unified technician
 * catalogue. Intentionally not imported by public routes or SSR.
 *
 * A DDD is a coarse telephone region indication, not a municipal coverage,
 * distance, online signal, technician identity, accepted service or SLA.
 * The caller must provide already-declared municipality IDs and DDDs;
 * source_page_city_ibge from quarantined captures is NEVER proof of coverage.
 * This does not authorize visibility, contact disclosure or publication.
 */
const DDD_FORMAT = /^[1-9][0-9]$/;

function checkedDDD(value) {
  if (typeof value !== "string" || !DDD_FORMAT.test(value)) {
    throw Error("DDD inválido");
  }
  // Shape only; validation against the official DDD catalogue is a separate
  // staging prerequisite. Do not pretend every numeric combination exists.
  return value;
}

function checkedMunicipality(value) {
  if (!Number.isSafeInteger(value) || value < 1000000 || value > 9999999) {
    throw Error("Código IBGE municipal inválido");
  }
  // Existence and UF must be validated against the existing IBGE catalogue
  // before backend integration. This fixture-only helper does not do so.
  return value;
}

function checkedArray(value, validator) {
  if (!Array.isArray(value) || value.length > 500) throw Error("Lista de evidências inválida");
  return new Set(value.map(validator));
}

/**
 * record: { enabled?, blocked?, quarantined?, declaredDdds?,
 *           declaredBaseCityIbgeId?, declaredCoverageCityIds? }
 * query: { ddd?, cityIbgeId? }
 *
 * No other record property is interpreted. In particular, the city of an
 * external capture and a phone number are not inferred into coverage/DDD.
 */
export function previewDeclaredRegionalMatch(record, query) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      !query || typeof query !== "object" || Array.isArray(query)) {
    throw Error("Entrada regional inválida");
  }
  const ddds = checkedArray(record.declaredDdds ?? [], checkedDDD);
  const covered = checkedArray(record.declaredCoverageCityIds ?? [], checkedMunicipality);
  if (record.declaredBaseCityIbgeId != null) {
    covered.add(checkedMunicipality(record.declaredBaseCityIbgeId));
  }

  const requestedDDD = query.ddd == null ? null : checkedDDD(query.ddd);
  const requestedCity = query.cityIbgeId == null ? null : checkedMunicipality(query.cityIbgeId);
  const dddMatch = requestedDDD !== null && ddds.has(requestedDDD);
  const municipalityMatch = requestedCity !== null && covered.has(requestedCity);
  const anyFilter = requestedDDD !== null || requestedCity !== null;

  // A requested municipality is NEVER satisfied merely by a matching DDD.
  // If both filters are supplied, both must match their own source of evidence.
  const evidenceMatchesFilters = anyFilter &&
    (requestedDDD === null || dddMatch) &&
    (requestedCity === null || municipalityMatch);
  const notRestricted = record.enabled === true &&
    record.blocked !== true && record.quarantined !== true;

  return Object.freeze({
    ddd_match: dddMatch,
    municipality_match: municipalityMatch,
    evidence_matches_filters: evidenceMatchesFilters,
    possible_match_for_review: evidenceMatchesFilters && notRestricted,
    match_evidence: !evidenceMatchesFilters ? "none" :
      requestedCity !== null ? "declared_municipality" : "telephone_region_approximate",
    geographic_claim: municipalityMatch
      ? "Cobertura municipal declarada"
      : dddMatch ? "Região telefônica aproximada (DDD)" : "Não informada",
    city_inferred_from_ddd: false,
    distance_km: null,
    availability_confirmed: null,
    service_confirmed: null,
    registry_id: null,
    // The preview is never an authoritative approval or public search result.
    publication_authorized: false,
  });
}
