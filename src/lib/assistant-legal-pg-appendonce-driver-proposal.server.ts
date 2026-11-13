import type {
  LocalLegalAppendOnce,
  LocalLegalWriteCommand,
} from "./assistant-legal-ledger-local-writer-proposal.server";

/**
 * Issue #261 — inert, server-only PostgreSQL row adapter.
 *
 * A future trusted handler must use requireSupabaseAuth, read server-owned
 * user_roles and active-account status, then provide a transaction with a
 * verified, SET LOCAL auth.uid() subject and a non-BYPASSRLS writer role.
 * This module DOES NOT open a connection, BEGIN/COMMIT, set auth claims,
 * grant privileges, or register a route. The existing service-role client
 * bypasses RLS and MUST NOT be used to provide `query`.
 */
export type LocalLegalPgQuery = (
  statement: string,
  parameters: readonly [string, string, string, string | null, string | null],
) => Promise<{ rows: unknown }>;

export const LOCAL_LEGAL_APPEND_ONCE_STATEMENT = `
SELECT status, event_seq, event_id, user_id, idempotency_key,
       event_kind, terms_version, privacy_notice_version, recorded_at
FROM eut_assistant_legal.append_once_local(
  $1::uuid, $2::uuid, $3::text, $4::text, $5::text
)
`;

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const EVENT_FIELDS = [
  "event_seq", "event_id", "user_id", "idempotency_key", "event_kind",
  "terms_version", "privacy_notice_version", "recorded_at",
] as const;

/** Must only receive a query owned by the subject-bound transaction callback. */
export function createProposedLocalPgAppendOnceDriver(
  query: LocalLegalPgQuery,
): LocalLegalAppendOnce {
  return async (command: LocalLegalWriteCommand) => {
    if (
      typeof query !== "function" ||
      !UUID.test(command.userId) ||
      !UUID.test(command.idempotencyKey) ||
      (command.eventKind !== "accept" && command.eventKind !== "revoke")
    ) return { status: "unavailable" };

    try {
      const response = await query(LOCAL_LEGAL_APPEND_ONCE_STATEMENT, [
        command.userId, command.idempotencyKey, command.eventKind,
        command.termsVersion, command.privacyNoticeVersion,
      ]);
      if (!Array.isArray(response?.rows) || response.rows.length !== 1) {
        return { status: "unavailable" };
      }
      const row: unknown = response.rows[0];
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { status: "unavailable" };
      }
      const record = row as Record<string, unknown>;
      if (record.status === "idempotency_conflict" ||
          record.status === "no_active_acceptance") {
        if (EVENT_FIELDS.some((key) => record[key] !== null)) {
          return { status: "unavailable" };
        }
        return { status: record.status };
      }
      if (record.status !== "appended" && record.status !== "replayed") {
        return { status: "unavailable" };
      }
      if (
        typeof record.event_seq !== "string" ||
        typeof record.event_id !== "string" ||
        typeof record.user_id !== "string" ||
        typeof record.idempotency_key !== "string" ||
        (record.event_kind !== "accept" && record.event_kind !== "revoke") ||
        !(record.terms_version === null || typeof record.terms_version === "string") ||
        !(record.privacy_notice_version === null || typeof record.privacy_notice_version === "string") ||
        typeof record.recorded_at !== "string"
      ) return { status: "unavailable" };

      // The existing writer independently verifies IDs, subject, versions,
      // chronology and audit receipt before reporting acceptance.
      return { status: record.status, audit: {
        eventSeq: record.event_seq,
        eventId: record.event_id,
        userId: record.user_id,
        idempotencyKey: record.idempotency_key,
        eventKind: record.event_kind,
        termsVersion: record.terms_version,
        privacyNoticeVersion: record.privacy_notice_version,
        recordedAt: record.recorded_at,
      } };
    } catch {
      // The enclosing transaction binding MUST throw on this outcome to roll back.
      return { status: "unavailable" };
    }
  };
}
