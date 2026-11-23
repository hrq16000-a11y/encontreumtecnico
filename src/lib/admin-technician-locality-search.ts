/** Safe, bounded PostgREST OR predicate for operational technician locality lookup.
 * No private contact fields, dynamic columns or untrusted structural operators. */
const PORTAL_SEARCH_FIELDS = ["display_name", "city", "state_uf", "region"] as const;

export function portalTechnicianSearchOr(raw: string): string {
  const term = raw.trim().replace(/[^\p{L}\p{N}\p{Pd}\s']/gu, " ")
    .replace(/\s+/g, " ").slice(0, 80).trim();
  if (!term) return "";
  return PORTAL_SEARCH_FIELDS.map((field) => `${field}.ilike.%${term}%`).join(",");
}
