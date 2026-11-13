import { describe, expect, it } from "vitest";
import { ASSISTANT_LEGAL_POLICY } from "./assistant-access-contract";
import { createProposedLocalAssistantLegalWriter, type LocalLegalWriteCommand } from "./assistant-legal-ledger-local-writer-proposal.server";
import {
  createProposedLocalPgAppendOnceDriver,
  LOCAL_LEGAL_APPEND_ONCE_STATEMENT,
} from "./assistant-legal-pg-appendonce-driver-proposal.server";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT = "99999999-9999-4999-8999-999999999999";
const NOW = Date.parse("2026-11-13T04:00:00.000Z");
const command: LocalLegalWriteCommand = {
  userId: SUBJECT,
  idempotencyKey: KEY,
  eventKind: "accept",
  termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
  privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
};
const successRow = {
  status: "appended", event_seq: "1", event_id: EVENT, user_id: SUBJECT,
  idempotency_key: KEY, event_kind: "accept",
  terms_version: command.termsVersion,
  privacy_notice_version: command.privacyNoticeVersion,
  recorded_at: "2026-11-13T03:00:00.000000Z",
};

describe("#261 synthetic PostgreSQL appendOnce row adapter", () => {
  it("sends one parameterized call and preserves the actual audit receipt", async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const query = async (sql: string, params: readonly unknown[]) => {
      calls.push({ sql, params });
      return { rows: [successRow] };
    };
    const writer = createProposedLocalAssistantLegalWriter(
      createProposedLocalPgAppendOnceDriver(query),
    );
    expect(await writer({ userId: SUBJECT, roles: ["cliente"], expiresAtMs: NOW + 60_000 },
      "accept", KEY, NOW)).toEqual({ status: "appended", audit: {
      eventId: EVENT, eventSeq: "1", recordedAt: successRow.recorded_at,
    } });
    expect(calls).toEqual([{ sql: LOCAL_LEGAL_APPEND_ONCE_STATEMENT,
      params: [SUBJECT, KEY, "accept", command.termsVersion, command.privacyNoticeVersion],
    }]);
    expect(calls[0].sql).toContain("$1::uuid, $2::uuid, $3::text, $4::text, $5::text");
    expect(calls[0].sql).not.toContain(SUBJECT);
  });

  it("preserves exact replay and explicit no-op statuses", async () => {
    const replay = createProposedLocalPgAppendOnceDriver(async () => ({
      rows: [{ ...successRow, status: "replayed" }],
    }));
    expect((await replay(command)).status).toBe("replayed");
    for (const status of ["idempotency_conflict", "no_active_acceptance"]) {
      const noOp = createProposedLocalPgAppendOnceDriver(async () => ({ rows: [{
        status, event_seq: null, event_id: null, user_id: null,
        idempotency_key: null, event_kind: null, terms_version: null,
        privacy_notice_version: null, recorded_at: null,
      }] }));
      expect(await noOp(command)).toEqual({ status });
    }
  });

  it("fails closed on errors, missing, extra, spoofed or malformed rows", async () => {
    const outcomes = [
      [], [successRow, successRow],
      [{ ...successRow, event_seq: 1 }],
      [{ ...successRow, user_id: "22222222-2222-4222-8222-222222222222" }],
      [{ ...successRow, status: "untrusted" }],
      [{ status: "idempotency_conflict", ...Object.fromEntries(
        ["event_seq", "event_id", "user_id", "idempotency_key", "event_kind",
          "terms_version", "privacy_notice_version", "recorded_at"].map((k) => [k, null]),
      ), event_id: EVENT }],
    ];
    for (const rows of outcomes) {
      const writer = createProposedLocalAssistantLegalWriter(
        createProposedLocalPgAppendOnceDriver(async () => ({ rows })),
      );
      expect(await writer({ userId: SUBJECT, roles: ["cliente"], expiresAtMs: NOW + 60_000 },
        "accept", KEY, NOW)).toEqual({ status: "unavailable" });
    }
    const failed = createProposedLocalPgAppendOnceDriver(async () => {
      throw new Error("synthetic SQL failure");
    });
    expect(await failed(command)).toEqual({ status: "unavailable" });
  });
});
