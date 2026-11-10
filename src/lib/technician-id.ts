/**
 * Checks the canonical shape of a PostgreSQL UUID without interpreting
 * unverified IDs as public profiles. Existence/approval is checked server-side.
 */
export function isValidTechnicianId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
