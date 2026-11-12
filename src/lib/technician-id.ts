/**
 * Checks the canonical shape of a PostgreSQL UUID without interpreting
 * unverified IDs as public profiles. Existence/approval is checked server-side.
 */
export function isValidTechnicianId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Stable human-readable key; never authorizes or publishes a private profile. */
export function isValidTechnicianSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 96 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
