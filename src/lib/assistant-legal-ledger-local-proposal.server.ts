import type {
  AssistantLegalEvidenceRead,
  AssistantLegalEvidenceRow,
  ReadAuthorizedAssistantLegalEvidence,
} from "./assistant-legal-evidence-gate";

/**
 * Issue #261 — LOCAL-ONLY, SERVER-SIDE ADAPTER PROPOSAL.
 *
 * Not imported by any route or AI endpoint. Does not open a database,
 * authenticate a user, write an event or read the hosted Supabase project.
 * Keep this .server.ts module out of client bundles.
 *
 * A future caller must first verify the Auth JWT/session, operational account
 * state and server-authorized roles, then supply a read-only LOCAL query
 * capability. Never build it from user input, browser state or a raw JWT.
 */
export type LocalLegalReadOnlyQuery = (
  sql: string,
  params: readonly [string],
) => Promise<{ rows: unknown }>;

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const MAX_EVENTS = 512;

/** The ONLY query this proposed reader needs, scoped to the verified subject. */
export const LOCAL_ASSISTANT_LEGAL_EVENTS_QUERY = `
SELECT event_seq::text AS event_seq,
       user_id::text AS user_id,
       event_kind,
       terms_version,
       privacy_notice_version,
       to_char(recorded_at AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS event_at
FROM eut_assistant_legal.acceptance_events
WHERE user_id = $1::uuid
ORDER BY event_seq ASC
LIMIT 513
`;

/**
 * Convert immutable accept/revoke events into the EXISTING fail-closed gate.
 * This intentionally has no write method, RPC, credential or active wiring.
 * A truncated, inconsistent or cross-user history never authorizes access.
 */
export function createLocalAssistantLegalEvidenceReader(
  readOnlyQuery: LocalLegalReadOnlyQuery,
): ReadAuthorizedAssistantLegalEvidence {
  return async (verifiedUserId: string): Promise<AssistantLegalEvidenceRead> => {
    if (!UUID.test(verifiedUserId) || typeof readOnlyQuery !== "function") {
      return { state: "unavailable" };
    }

    try {
      const response = await readOnlyQuery(
        LOCAL_ASSISTANT_LEGAL_EVENTS_QUERY,
        [verifiedUserId],
      );
      const events = response?.rows;
      if (!Array.isArray(events) || events.length > MAX_EVENTS) {
        return { state: "unavailable" };
      }
      if (events.length === 0) return { state: "missing" };

      let lastSequence = BigInt(0);
      let lastTimestamp = Number.NEGATIVE_INFINITY;
      let current: AssistantLegalEvidenceRow | null = null;

      for (const value of events) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return { state: "unavailable" };
        }

        const event = value as Record<string, unknown>;
        const sequenceText = event.event_seq;
        const eventUserId = event.user_id;
        const timestamp = event.event_at;
        if (
          typeof sequenceText !== "string" ||
          !/^[1-9]\d*$/.test(sequenceText) ||
          typeof eventUserId !== "string" ||
          !UUID.test(eventUserId) ||
          eventUserId.toLowerCase() !== verifiedUserId.toLowerCase() ||
          typeof timestamp !== "string" ||
          !ISO_TIME.test(timestamp)
        ) return { state: "unavailable" };

        const sequence = BigInt(sequenceText);
        const timeMs = Date.parse(timestamp);
        if (
          sequence <= lastSequence ||
          !Number.isFinite(timeMs) ||
          timeMs <= lastTimestamp
        ) return { state: "unavailable" };
        lastSequence = sequence;
        lastTimestamp = timeMs;

        if (event.event_kind === "accept") {
          if (
            typeof event.terms_version !== "string" ||
            !event.terms_version.trim() ||
            typeof event.privacy_notice_version !== "string" ||
            !event.privacy_notice_version.trim()
          ) return { state: "unavailable" };

          current = {
            userId: verifiedUserId,
            termsVersion: event.terms_version,
            privacyNoticeVersion: event.privacy_notice_version,
            acceptedAt: timestamp,
            revokedAt: null,
          };
        } else if (event.event_kind === "revoke") {
          if (
            event.terms_version !== null ||
            event.privacy_notice_version !== null ||
            !current ||
            current.revokedAt !== null
          ) return { state: "unavailable" };
          current = { ...current, revokedAt: timestamp };
        } else {
          return { state: "unavailable" };
        }
      }

      return current ? { state: "found", row: current } : { state: "missing" };
    } catch {
      // SQL error, unavailable DB, malformed rows and timeouts must deny.
      return { state: "unavailable" };
    }
  };
}
