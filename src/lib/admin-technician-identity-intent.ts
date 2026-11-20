export type TechnicianIdentityField =
  | "email" | "postal_code" | "street" | "number" | "complement"
  | "neighborhood" | "city" | "uf";

export type TechnicianIdentityDraft = Record<TechnicianIdentityField, string>;
export type TechnicianIdentityPayload = Record<TechnicianIdentityField, string | null>;

/** Compare exactly what the private identity RPC will persist. */
export function technicianIdentityPayload(draft: TechnicianIdentityDraft): TechnicianIdentityPayload {
  return {
    email: draft.email.trim().toLowerCase() || null,
    postal_code: draft.postal_code.replace(/\D/g, "") || null,
    street: draft.street.trim() || null,
    number: draft.number.trim() || null,
    complement: draft.complement.trim() || null,
    neighborhood: draft.neighborhood.trim() || null,
    city: draft.city.trim() || null,
    uf: draft.uf.trim().toUpperCase() || null,
  };
}

export function shouldWriteTechnicianIdentity(
  current: TechnicianIdentityPayload,
  original: TechnicianIdentityPayload | null,
  existingRecord: boolean,
): boolean {
  if (!existingRecord) return Object.values(current).some((value) => value !== null);
  // The editor must finish loading the private baseline before enabling save.
  if (!original) return false;
  return (Object.keys(current) as TechnicianIdentityField[])
    .some((field) => current[field] !== original[field]);
}
