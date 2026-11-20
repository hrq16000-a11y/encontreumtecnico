/** Confirm owner-scoped coverage after the write RPC; a success flag alone is
 * insufficient to report that the selected municipalities were persisted. */
export function technicianCoverageWasPersisted(
  expectedCities: readonly number[], expectedRadius: number | null,
  saved: { coverage_city_ids: number[] | null; service_radius_km: number | null } | null,
): boolean {
  if (!saved || !Array.isArray(saved.coverage_city_ids)) return false;
  const actual = saved.coverage_city_ids;
  return saved.service_radius_km === expectedRadius &&
    new Set(expectedCities).size === expectedCities.length &&
    new Set(actual).size === actual.length &&
    actual.length === expectedCities.length && expectedCities.every(id => actual.includes(id));
}
