/** Confirm the fields that the publication RPC promises to persist before
 * reporting success or clearing the private draft. Never read private contacts. */
export type TechnicianPublicationFields = {
  display_name: string;
  state_uf: string;
  city: string;
  neighborhood: string;
  region: string;
  bio: string;
  specialties: string[];
  service_slugs: string[];
};

export type PublishedTechnicianSnapshot = {
  id: string;
  status: string;
  display_name: string;
  state_uf: string | null;
  city: string;
  neighborhood: string | null;
  region: string | null;
  bio: string | null;
  specialties: string[] | null;
  service_slugs: string[] | null;
};

const normalized = (value: string | null) => (value ?? "").trim();
const sameValues = (left: string[], right: string[] | null) =>
  Array.isArray(right) &&
  new Set(left).size === left.length &&
  new Set(right).size === right.length &&
  left.length === right.length &&
  left.every((value) => right.includes(value));

export function technicianPublicationWasPersisted(
  requested: TechnicianPublicationFields,
  saved: PublishedTechnicianSnapshot | null,
  expectedId?: string,
): boolean {
  if (!saved || saved.status !== "aprovado" || (expectedId && saved.id !== expectedId)) return false;
  return normalized(saved.display_name) === normalized(requested.display_name)
    && normalized(saved.state_uf) === normalized(requested.state_uf)
    && normalized(saved.city) === normalized(requested.city)
    && normalized(saved.neighborhood) === normalized(requested.neighborhood)
    && normalized(saved.region) === normalized(requested.region)
    && normalized(saved.bio) === normalized(requested.bio)
    && sameValues(requested.specialties, saved.specialties)
    && sameValues(requested.service_slugs, saved.service_slugs);
}
