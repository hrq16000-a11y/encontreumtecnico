import {
  ASSISTANT_LEGAL_POLICY,
  decideAssistantAccess,
  type TrustedAssistantSession,
} from "./assistant-access-contract";

/**
 * Issue #261 — LOCAL-ONLY writer proposal, not wired to any route or AI.
 *
 * No database client, SQL execution, credentials, RPC or production mutation.
 * The caller MUST independently verify Auth session, account status and roles.
 * Only a trusted server may supply appendOnce; never accept it from a request,
 * a browser session or user-editable metadata.
 *
 * The future implementation of appendOnce MUST be a single atomic, per-user
 * transaction against eut_assistant_legal.acceptance_events that:
 * - inserts an immutable event with the unique (user_id, idempotency_key);
 * - replays only an EXACTLY matching prior command, never overwrites a row;
 * - rejects a conflicting reuse of a key;
 * - rejects revoke without a currently active acceptance (unless replayed);
 * - serializes events and makes recorded_at strictly increasing at millisecond
 *   precision for the existing fail-closed reader, including concurrent writes;
 * - returns the DB-generated event ID, order and timestamp as audit evidence.
 * Until that transaction exists and is tested locally, this is NOT persistence.
 */

export type LocalLegalEventKind = "accept" | "revoke";

export type LocalLegalWriteCommand = Readonly<{
  userId: string;
  idempotencyKey: string;
  eventKind: LocalLegalEventKind;
  termsVersion: string | null;
  privacyNoticeVersion: string | null;
}>;

export type LocalLegalStoredAudit = Readonly<{
  eventSeq: string;
  eventId: string;
  userId: string;
  idempotencyKey: string;
  eventKind: LocalLegalEventKind;
  termsVersion: string | null;
  privacyNoticeVersion: string | null;
  recordedAt: string;
}>;

/** An atomic LOCAL storage operation, deliberately injected and unimplemented. */
export type LocalLegalAppendOnce = (
  command: LocalLegalWriteCommand,
) => Promise<
  | { status: "appended" | "replayed"; audit: LocalLegalStoredAudit }
  | { status: "idempotency_conflict" | "no_active_acceptance" | "unavailable" }
>;

export type LocalLegalWriteResult =
  | {
      status: "appended" | "replayed";
      audit: Readonly<{ eventId: string; eventSeq: string; recordedAt: string }>;
    }
  | { status: "denied" | "idempotency_conflict" | "no_active_acceptance" | "unavailable" };

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const ISO_MICROSECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const SEQUENCE = /^[1-9]\d*$/;
const MAX_CLOCK_SKEW_MS = 60_000;

function isMatchingAudit(
  value: unknown,
  command: LocalLegalWriteCommand,
  nowMs: number,
): value is LocalLegalStoredAudit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const audit = value as Record<string, unknown>;
  if (
    typeof audit.eventSeq !== "string" ||
    !SEQUENCE.test(audit.eventSeq) ||
    typeof audit.eventId !== "string" ||
    !UUID.test(audit.eventId) ||
    typeof audit.userId !== "string" ||
    audit.userId.toLowerCase() !== command.userId.toLowerCase() ||
    typeof audit.idempotencyKey !== "string" ||
    audit.idempotencyKey.toLowerCase() !== command.idempotencyKey.toLowerCase() ||
    audit.eventKind !== command.eventKind ||
    audit.termsVersion !== command.termsVersion ||
    audit.privacyNoticeVersion !== command.privacyNoticeVersion ||
    typeof audit.recordedAt !== "string" ||
    !ISO_MICROSECONDS.test(audit.recordedAt)
  ) return false;

  const recordedMs = Date.parse(audit.recordedAt);
  return Number.isFinite(recordedMs) &&
    recordedMs > 0 &&
    recordedMs <= nowMs + MAX_CLOCK_SKEW_MS;
}

/**
 * Pure orchestration around a future LOCAL append-only transaction.
 * Exact policy versions are sourced from the existing contract, NEVER from UI.
 * A malformed or inconsistent receipt fails closed even if a driver claimed
 * an append/replay. This return value is not assistant authorization.
 */
export function createProposedLocalAssistantLegalWriter(
  appendOnce: LocalLegalAppendOnce,
) {
  return async (
    principal: TrustedAssistantSession | null,
    eventKind: LocalLegalEventKind,
    idempotencyKey: string,
    nowMs: number,
  ): Promise<LocalLegalWriteResult> => {
    const initial = decideAssistantAccess(principal, null, nowMs);
    if (
      !principal ||
      initial.reason !== "acceptance_required" ||
      (eventKind !== "accept" && eventKind !== "revoke") ||
      typeof idempotencyKey !== "string" ||
      !UUID.test(idempotencyKey) ||
      typeof appendOnce !== "function"
    ) return { status: "denied" };

    const command: LocalLegalWriteCommand = Object.freeze({
      userId: principal.userId,
      idempotencyKey,
      eventKind,
      termsVersion: eventKind === "accept" ? ASSISTANT_LEGAL_POLICY.termsVersion : null,
      privacyNoticeVersion:
        eventKind === "accept" ? ASSISTANT_LEGAL_POLICY.privacyNoticeVersion : null,
    });

    try {
      const result = await appendOnce(command);
      if (
        result?.status === "idempotency_conflict" ||
        result?.status === "no_active_acceptance"
      ) return { status: result.status };

      if (
        !result ||
        (result.status !== "appended" && result.status !== "replayed") ||
        !isMatchingAudit(result.audit, command, nowMs)
      ) return { status: "unavailable" };

      return {
        status: result.status,
        audit: {
          eventId: result.audit.eventId,
          eventSeq: result.audit.eventSeq,
          recordedAt: result.audit.recordedAt,
        },
      };
    } catch {
      // Storage errors and malformed audit receipts never imply an acceptance.
      return { status: "unavailable" };
    }
  };
}
