import { describe, expect, it } from "vitest";
import {
  createLocalAssistantLegalEvidenceReader,
  LOCAL_ASSISTANT_LEGAL_EVENTS_QUERY,
  type LocalLegalReadOnlyQuery,
} from "./assistant-legal-ledger-local-proposal.server";
import { ASSISTANT_LEGAL_POLICY } from "./assistant-access-contract";

/**
 * Issue #261 — in-memory verification of the NEW server-only reader.
 * No SQL execution, database, Auth request, AI gateway or network calls.
 * Only the injected read-only query function is simulated.
 */
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const T1 = "2026-11-13T03:00:00.000000Z";
const T2 = "2026-11-13T03:10:00.000000Z";
const T3 = "2026-11-13T03:20:00.000000Z";

type EventRow = {
  event_seq: string;
  user_id: string;
  event_kind: "accept" | "revoke";
  terms_version: string | null;
  privacy_notice_version: string | null;
  event_at: string;
};

const accept = (
  sequence: number,
  userId = USER,
  at = T1,
  termsVersion: string = ASSISTANT_LEGAL_POLICY.termsVersion,
): EventRow => ({
  event_seq: String(sequence),
  user_id: userId,
  event_kind: "accept",
  terms_version: termsVersion,
  privacy_notice_version: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
  event_at: at,
});

const revoke = (sequence: number, userId = USER, at = T2): EventRow => ({
  event_seq: String(sequence),
  user_id: userId,
  event_kind: "revoke",
  terms_version: null,
  privacy_notice_version: null,
  event_at: at,
});

function inMemoryReader(events: EventRow[]) {
  const calls: Array<{ sql: string; params: readonly [string] }> = [];
  const query: LocalLegalReadOnlyQuery = async (sql, params) => {
    calls.push({ sql, params });
    // Model the SQL WHERE user_id = $1 with synthetic rows only.
    return { rows: events.filter((event) => event.user_id === params[0]) };
  };
  return { read: createLocalAssistantLegalEvidenceReader(query), calls };
}

describe("assistant server-only legal ledger reader — synthetic fixture #261", () => {
  it("reads a versioned acceptance only for the server-verified subject", async () => {
    const { read, calls } = inMemoryReader([accept(1)]);
    expect(await read(USER)).toEqual({
      state: "found",
      row: {
        userId: USER,
        termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
        privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
        acceptedAt: T1,
        revokedAt: null,
      },
    });
    expect(calls).toEqual([{ sql: LOCAL_ASSISTANT_LEGAL_EVENTS_QUERY, params: [USER] }]);
  });

  it("represents revocation and requires a later acceptance to clear it", async () => {
    const events = [accept(1)];
    const { read } = inMemoryReader(events);
    expect(await read(USER)).toMatchObject({ state: "found", row: { revokedAt: null } });
    events.push(revoke(2));
    expect(await read(USER)).toMatchObject({
      state: "found",
      row: { acceptedAt: T1, revokedAt: T2 },
    });
    events.push(accept(3, USER, T3));
    expect(await read(USER)).toMatchObject({
      state: "found",
      row: { acceptedAt: T3, revokedAt: null },
    });
  });

  it("never borrows another subject's acceptance, including a faulty query response", async () => {
    const { read, calls } = inMemoryReader([accept(1, OTHER)]);
    expect(await read(USER)).toEqual({ state: "missing" });
    expect(await read(OTHER)).toMatchObject({
      state: "found",
      row: { userId: OTHER },
    });
    expect(calls.map((call) => call.params)).toEqual([[USER], [OTHER]]);

    const faultyQuery: LocalLegalReadOnlyQuery = async () => ({
      rows: [accept(1, OTHER)],
    });
    expect(await createLocalAssistantLegalEvidenceReader(faultyQuery)(USER)).toEqual({
      state: "unavailable",
    });
  });

  it("fails closed on a read error, malformed response and unverified subject", async () => {
    let calls = 0;
    const broken: LocalLegalReadOnlyQuery = async () => {
      calls++;
      throw new Error("synthetic local read failure");
    };
    const read = createLocalAssistantLegalEvidenceReader(broken);
    expect(await read(USER)).toEqual({ state: "unavailable" });
    expect(await read("not-a-verified-uuid")).toEqual({ state: "unavailable" });
    expect(calls).toBe(1);
    expect(await createLocalAssistantLegalEvidenceReader(async () => ({
      rows: null,
    }))(USER)).toEqual({ state: "unavailable" });
  });

  it("rejects ambiguous or reversed event sequences", async () => {
    const reversed = inMemoryReader([accept(2), revoke(1)]);
    expect(await reversed.read(USER)).toEqual({ state: "unavailable" });
    const repeated = inMemoryReader([accept(1), revoke(1)]);
    expect(await repeated.read(USER)).toEqual({ state: "unavailable" });
  });

  it("rejects events with indistinguishable timestamps even with ordered sequences", async () => {
    const reader = inMemoryReader([accept(1), revoke(2, USER, T1)]);
    expect(await reader.read(USER)).toEqual({ state: "unavailable" });
  });

  it("denies 513 returned events instead of treating a truncated history as complete", async () => {
    const events = Array.from({ length: 513 }, (_, index) => accept(index + 1));
    const { read } = inMemoryReader(events);
    expect(await read(USER)).toEqual({ state: "unavailable" });
  });
});
