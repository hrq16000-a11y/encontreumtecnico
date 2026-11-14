import type { PreparedEdit } from "./admin-technician-crud-intent";

/**
 * Offline contract fixture only. The server RPC is a proposal, NOT installed.
 * Do not send this payload, persist it, log it, or expose it through SSR.
 */
export function buildProposedTechnicianChangeArgs(edit: PreparedEdit) {
  const phone = edit.changes.phone;
  return {
    _technician_id: edit.technicianId,
    _expected_updated_at: edit.expectedUpdatedAt,
    _reason: edit.reason,
    _payload: {
      base_city_ibge_id: edit.changes.baseCityId,
      coverage_city_ids: [...edit.changes.coverageCityIds],
      radius_km: edit.changes.radiusKm,
      neighborhood: edit.changes.neighborhood,
      category_slugs: [...edit.changes.categorySlugs],
      service_slugs: [...edit.changes.serviceSlugs],
      phone_action: phone.kind,
      ...(phone.kind === "replace"
        ? {
            phone_e164: phone.e164,
            allow_paid_contact: phone.allowPaidContact,
          }
        : {}),
    },
  };
}
