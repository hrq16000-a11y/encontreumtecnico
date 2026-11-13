import { describe, expect, it } from "vitest";
import { ASSISTANT_LEGAL_POLICY, type TrustedAssistantSession } from "./assistant-access-contract";
import {
  createProposedLocalAssistantLegalWriter,
  type LocalLegalAppendOnce,
  type LocalLegalStoredAudit,
  type LocalLegalWriteCommand,
} from "./assistant-legal-ledger-local-writer-proposal.server";

/**
 * Issue #261: synthetic transaction double, NOT a DB test or proof of RLS.
 * Executes no SQL, Supabase, network, route or AI call.
 */
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const KEY1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KEY3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EVENT_ID = "99999999-9999-4999-8999-999999999999";
const NOW = Date.parse("2026-11-13T04:00:00.000Z");
const T1 = "2026-11-13T03:01:00.000000Z";

const session = (
  userId = USER,
  roles: string[] = ["cliente"],
  expiresAtMs = NOW + 60_000,
): TrustedAssistantSession => ({ userId, roles, expiresAtMs });

function auditFor(
  command: LocalLegalWriteCommand,
  overrides: Partial<LocalLegalStoredAudit> = {},
): LocalLegalStoredAudit {
  return {
    eventSeq: "1",
    eventId: EVENT_ID,
    userId: command.userId,
    idempotencyKey: command.idempotencyKey,
    eventKind: command.eventKind,
    termsVersion: command.termsVersion,
    privacyNoticeVersion: command.privacyNoticeVersion,
    recordedAt: T1,
    ...overrides,
  };
}

function syntheticAppendOnce() {
  const events: LocalLegalStoredAudit[] = [];
  const appendOnce: LocalLegalAppendOnce = async (command) => {
    const prior = events.find(
      (event) => event.userId === command.userId &&
        event.idempotencyKey === command.idempotencyKey,
    );
    if (prior) {
      const identical = prior.eventKind === command.eventKind &&
        prior.termsVersion === command.termsVersion &&
        prior.privacyNoticeVersion === command.privacyNoticeVersion;
      return identical
        ? { status: "replayed", audit: prior }
        : { status: "idempotency_conflict" };
    }
    const latest = events.filter((event) => event.userId === command.userId).at(-1);
    if (command.eventKind === "revoke" && latest?.eventKind !== "accept") {
      return { status: "no_active_acceptance" };
    }
    const sequence = events.length + 1;
    const recordedAt = new Date(Date.parse(T1) + (sequence - 1) * 60_000)
      .toISOString().replace(".000Z", ".000000Z");
    const event = auditFor(command, {
      eventSeq: String(sequence),
      eventId: "00000000-0000-4000-8000-" + String(sequence).padStart(12, "0"),
      recordedAt,
    });
    events.push(event);
    return { status: "appended", audit: event };
  };
  return { events, appendOnce };
}

describe("assistant legal writer — isolated in-memory fixture #261", () => {
  it("denies missing/expired sessions, unauthorized roles and invalid keys without writing", async () => {
    let calls = 0;
    const appendOnce: LocalLegalAppendOnce = async (command) => {
      calls++;
      return { status: "appended", audit: auditFor(command) };
    };
    const write = createProposedLocalAssistantLegalWriter(appendOnce);
    expect(await write(null, "accept", KEY1, NOW)).toEqual({ status: "denied" });
    expect(await write(session(USER, ["visitante"]), "accept", KEY1, NOW))
      .toEqual({ status: "denied" });
    expect(await write(session(USER, ["cliente"], NOW), "accept", KEY1, NOW))
      .toEqual({ status: "denied" });
    expect(await write(session("unverified-user"), "accept", KEY1, NOW))
      .toEqual({ status: "denied" });
    expect(await write(session(), "accept", "bad-key", NOW))
      .toEqual({ status: "denied" });
    expect(await write(session(), "erase" as "accept", KEY1, NOW))
      .toEqual({ status: "denied" });
    expect(calls).toBe(0);
  });

  it("derives the exact versioned acceptance and verified subject, returning audit IDs", async () => {
    const commands: LocalLegalWriteCommand[] = [];
    const appendOnce: LocalLegalAppendOnce = async (command) => {
      commands.push(command);
      return { status: "appended", audit: auditFor(command) };
    };
    const write = createProposedLocalAssistantLegalWriter(appendOnce);
    expect(await write(session(), "accept", KEY1, NOW)).toEqual({
      status: "appended",
      audit: { eventId: EVENT_ID, eventSeq: "1", recordedAt: T1 },
    });
    expect(commands).toEqual([{
      userId: USER,
      idempotencyKey: KEY1,
      eventKind: "accept",
      termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
      privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
    }]);
    expect(Object.isFrozen(commands[0])).toBe(true);
  });

  it("rejects orphan revocation, then records revocation and a fresh acceptance", async () => {
    const storage = syntheticAppendOnce();
    const write = createProposedLocalAssistantLegalWriter(storage.appendOnce);
    expect(await write(session(), "revoke", KEY1, NOW))
      .toEqual({ status: "no_active_acceptance" });
    expect(storage.events).toHaveLength(0);
    expect((await write(session(), "accept", KEY1, NOW)).status).toBe("appended");
    expect((await write(session(), "revoke", KEY2, NOW)).status).toBe("appended");
    expect((await write(session(), "accept", KEY3, NOW)).status).toBe("appended");
    expect(storage.events.map((event) => event.eventKind))
      .toEqual(["accept", "revoke", "accept"]);
    expect(storage.events[1]).toMatchObject({
      userId: USER, termsVersion: null, privacyNoticeVersion: null,
    });
  });

  it("replays an identical key without inserting or resurrecting a revoked grant", async () => {
    const storage = syntheticAppendOnce();
    const write = createProposedLocalAssistantLegalWriter(storage.appendOnce);
    const first = await write(session(), "accept", KEY1, NOW);
    const repeat = await write(session(), "accept", KEY1, NOW);
    expect(repeat).toEqual({ ...first, status: "replayed" });
    expect(storage.events).toHaveLength(1);
    expect((await write(session(), "revoke", KEY2, NOW)).status).toBe("appended");
    expect((await write(session(), "accept", KEY1, NOW)).status).toBe("replayed");
    expect(storage.events).toHaveLength(2);
    expect(storage.events.at(-1)?.eventKind).toBe("revoke");
  });

  it("rejects reuse of an idempotency key for another operation", async () => {
    const storage = syntheticAppendOnce();
    const write = createProposedLocalAssistantLegalWriter(storage.appendOnce);
    expect((await write(session(), "accept", KEY1, NOW)).status).toBe("appended");
    expect(await write(session(), "revoke", KEY1, NOW))
      .toEqual({ status: "idempotency_conflict" });
    expect(storage.events).toHaveLength(1);
  });

  it("fails closed if storage returns inconsistent audit identity, version, time or order", async () => {
    const invalid: Array<Partial<LocalLegalStoredAudit>> = [
      { userId: OTHER },
      { termsVersion: "old-terms" },
      { privacyNoticeVersion: "old-privacy" },
      { idempotencyKey: KEY2 },
      { eventKind: "revoke" },
      { eventSeq: "0" },
      { eventId: "not-a-uuid" },
      { recordedAt: "2026-11-14T04:00:00.000000Z" },
    ];
    for (const alteration of invalid) {
      const appendOnce: LocalLegalAppendOnce = async (command) => ({
        status: "appended", audit: auditFor(command, alteration),
      });
      const write = createProposedLocalAssistantLegalWriter(appendOnce);
      expect(await write(session(), "accept", KEY1, NOW))
        .toEqual({ status: "unavailable" });
    }
  });

  it("denies a rejected storage operation or unavailable transaction", async () => {
    const failed: LocalLegalAppendOnce = async () => {
      throw new Error("synthetic transaction unavailable");
    };
    expect(await createProposedLocalAssistantLegalWriter(failed)(
      session(), "accept", KEY1, NOW,
    )).toEqual({ status: "unavailable" });
    const unavailable: LocalLegalAppendOnce = async () => ({ status: "unavailable" });
    expect(await createProposedLocalAssistantLegalWriter(unavailable)(
      session(), "accept", KEY1, NOW,
    )).toEqual({ status: "unavailable" });
  });
});
