import type { PreparedEdit } from "./admin-technician-crud-intent";

/** A save is valid only for the exact version and fields the admin previewed. */
export function unchangedSinceValidatedPreview(previous: PreparedEdit, current: PreparedEdit) {
  return JSON.stringify(previous) === JSON.stringify(current);
}

/** Map a validated, transient admin form to the server's restricted RPC contract. */
export function adminTechnicianChangePayload(edit: PreparedEdit) {
  const { changes } = edit;
  return {
    base_city_ibge_id: changes.baseCityId,
    coverage_city_ids: changes.coverageCityIds,
    radius_km: changes.radiusKm,
    neighborhood: changes.neighborhood,
    category_slugs: changes.categorySlugs,
    service_slugs: changes.serviceSlugs,
    phone_action: changes.phone.kind,
    // A contact replacement never activates a paid contact or clears a block.
    ...(changes.phone.kind === "replace"
      ? { phone_e164: changes.phone.e164, allow_paid_contact: false }
      : {}),
  };
}
