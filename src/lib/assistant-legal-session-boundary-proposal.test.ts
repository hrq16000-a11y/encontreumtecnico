import { describe, expect, it } from "vitest";
import { ASSISTANT_LEGAL_POLICY } from "./assistant-access-contract";
import { createProposedSessionBoundAssistantLegalWriter } from "./assistant-legal-session-boundary-proposal.server";
import type {
  LocalLegalAppendOnce,
  LocalLegalWriteCommand,
} from "./assistant-legal-ledger-local-writer-proposal.server";

/** Offline synthetic fixture: no Auth, SQL, network or AI requests. */
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = Date.parse("2026-11-13T04:00:00.000Z");

describe("#261 server-bound legal writer proposal — isolated synthetic boundary", () => {
  it("only derives subject, active account and roles from server capabilities", async () => {
    let lookedUp: string | null = null;
    let stored: LocalLegalWriteCommand | null = null;
    const appendOnce: LocalLegalAppendOnce = async (command) => {
      stored = command;
      return {
        status: "appended",
        audit: {
          eventSeq: "1", eventId: "99999999-9999-4999-8999-999999999999",
          userId: command.userId, idempotencyKey: command.idempotencyKey,
          eventKind: command.eventKind, termsVersion: command.termsVersion,
          privacyNoticeVersion: command.privacyNoticeVersion,
          recordedAt: "2026-11-13T03:00:00.000000Z",
        },
      };
    };
    const write = createProposedSessionBoundAssistantLegalWriter({
      verifySession: async () => ({ userId: USER, expiresAtMs: NOW + 60_000 }),
      readAccount: async (verifiedUserId) => {
        lookedUp = verifiedUserId;
        return { userId: USER, isActive: true, roles: ["cliente"] };
      },
      appendOnce,
    });
    expect((await write("accept", KEY, NOW)).status).toBe("appended");
    expect(lookedUp).toBe(USER);
    expect(stored).toMatchObject({
      userId: USER, idempotencyKey: KEY, eventKind: "accept",
      termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
      privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
    });
    expect(Object.isFrozen(stored)).toBe(true);
  });

  it("never invokes storage for missing, expired, blocked, foreign or unauthorized identities", async () => {
    let writes = 0;
    let roleLookups = 0;
    const appendOnce: LocalLegalAppendOnce = async () => {
      writes++;
      return { status: "unavailable" };
    };
    const cases = [
      { verifySession: async () => null, readAccount: async () => null },
      { verifySession: async () => ({ userId: "invalid-subject", expiresAtMs: NOW + 1000 }),
        readAccount: async () => { roleLookups++; return null; } },
      { verifySession: async () => ({ userId: USER, expiresAtMs: NOW }),
        readAccount: async () => ({ userId: USER, isActive: true, roles: ["cliente"] }) },
      { verifySession: async () => ({ userId: USER, expiresAtMs: NOW + 1000 }),
        readAccount: async () => ({ userId: USER, isActive: false, roles: ["cliente"] }) },
      { verifySession: async () => ({ userId: USER, expiresAtMs: NOW + 1000 }),
        readAccount: async () => ({ userId: OTHER, isActive: true, roles: ["cliente"] }) },
      { verifySession: async () => ({ userId: USER, expiresAtMs: NOW + 1000 }),
        readAccount: async () => ({ userId: USER, isActive: true, roles: ["visitante"] }) },
    ];
    for (const identity of cases) {
      const write = createProposedSessionBoundAssistantLegalWriter({ ...identity, appendOnce });
      expect(await write("accept", KEY, NOW)).toEqual({ status: "denied" });
    }
    expect(writes).toBe(0);
    expect(roleLookups).toBe(0);
  });

  it("fails closed when session or server-authorized role lookup throws", async () => {
    let writes = 0;
    const appendOnce: LocalLegalAppendOnce = async () => {
      writes++;
      return { status: "unavailable" };
    };
    const unavailable = async () => { throw new Error("synthetic trusted lookup unavailable"); };
    const a = createProposedSessionBoundAssistantLegalWriter({
      verifySession: unavailable, readAccount: async () => null, appendOnce,
    });
    const b = createProposedSessionBoundAssistantLegalWriter({
      verifySession: async () => ({ userId: USER, expiresAtMs: NOW + 1000 }),
      readAccount: unavailable,
      appendOnce,
    });
    expect(await a("accept", KEY, NOW)).toEqual({ status: "unavailable" });
    expect(await b("accept", KEY, NOW)).toEqual({ status: "unavailable" });
    expect(writes).toBe(0);
  });
});
