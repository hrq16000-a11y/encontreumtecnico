import { saveProtectedDraft } from "./protected-session-draft";
import type { ClientRequestDraft, ClientRequestStep } from "./client-request-wizard";

/**
 * Write the latest client wizard state synchronously inside the input or
 * navigation event, before React effects and route transitions can run.
 *
 * The caller must provide a verified, currently active client owner.
 * This never stores consent, selected technician, payment or login secrets.
 */
export function saveClientRequestDraftImmediately(
  ownerId: string | null,
  verifiedClient: boolean,
  form: ClientRequestDraft,
  step: ClientRequestStep,
  storage?: Storage,
): boolean {
  if (!ownerId || !verifiedClient) return false;
  return saveProtectedDraft("cliente", ownerId, form, step, storage);
}
