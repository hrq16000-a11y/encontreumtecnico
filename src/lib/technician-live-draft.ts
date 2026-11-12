import { saveProtectedDraft } from "./protected-session-draft";
import type { RegistrationStep } from "./technician-registration-wizard";

/** Save technician inputs synchronously on each edit / stage change.
 * The caller must confirm the active technician owner and loaded profile.
 * Never stores OAuth, contact unlock, consent or payment authorization.
 */
export function saveTechnicianDraftImmediately<T extends object>(
  ownerId: string | null,
  verifiedTechnician: boolean,
  form: T,
  step: RegistrationStep,
  storage?: Storage,
): boolean {
  if (!ownerId || !verifiedTechnician) return false;
  return saveProtectedDraft("tecnico", ownerId, form, step, storage);
}
