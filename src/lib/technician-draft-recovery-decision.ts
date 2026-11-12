import type { DraftOperation, DurableDraftRecord } from "./staged-technician-durable-draft";
import type { TechnicianDraftFields } from "./staged-technician-durable-draft";

type LocalDraft = { form: TechnicianDraftFields; step: number };

/**
 * Pure rollout decision. This does not call Supabase and has NO caller in the
 * current wizard. Both candidates must have been fetched using the same
 * verified account ID. Never merge form fields across owners or revisions.
 */
export type DraftRestoreDecision =
  | { kind: "none" }
  | { kind: "local"; value: LocalDraft; degraded: boolean }
  | { kind: "durable"; value: DurableDraftRecord }
  | { kind: "review_both"; local: LocalDraft; durable: DurableDraftRecord };

export function decideTechnicianDraftRecovery(args: {
  ownerVerified: boolean;
  profileAlreadyPublished: boolean;
  local: LocalDraft | null;
  remote: DraftOperation<DurableDraftRecord>;
}): DraftRestoreDecision {
  const { ownerVerified, profileAlreadyPublished, local, remote } = args;
  if (!ownerVerified || profileAlreadyPublished) return { kind: "none" };
  if (remote.status !== "ok") {
    // Backend absent or failed: keep local unsent data. Never silently erase.
    return local ? { kind: "local", value: local, degraded: remote.status !== "missing" } : { kind: "none" };
  }
  if (!local) return { kind: "durable", value: remote.value };
  if (local.step === remote.value.step &&
      JSON.stringify(local.form) === JSON.stringify(remote.value.form)) {
    return { kind: "durable", value: remote.value };
  }
  // A different local tab/session can contain newer edits. Do not overwrite
  // either copy automatically. UI must ask which version to keep.
  return { kind: "review_both", local, durable: remote.value };
}
