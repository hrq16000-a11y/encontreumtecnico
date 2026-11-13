import { describe, expect, it } from "vitest";
import { ASSISTANT_LEGAL_POLICY } from "./assistant-access-contract";
import { createProposedBoundLocalLegalTransaction } from "./assistant-legal-transaction-binding-proposal.server";
import type { LocalLegalAppendOnce, LocalLegalWriteCommand } from "./assistant-legal-ledger-local-writer-proposal.server";
import type { VerifiedAssistantAuthContext } from "./assistant-verified-auth-context";

/** Only synthetic capabilities; no hosted Auth, DB driver, SQL, network or AI. */
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = Date.parse("2026-11-13T04:00:00.000Z");
const verified: VerifiedAssistantAuthContext = {
  userId: USER,
  claims: { sub: USER, exp: Math.floor((NOW + 60_000) / 1000) },
};
const ownAccount = () => ({ userId: USER, isActive: true, roleRows: [{ role: "cliente" }] });

describe("#261 synthetic subject-bound transactional adapter", () => {
  it("binds verified subject and server-authorized role to one transaction", async () => {
    let roleLookupSubject: string | undefined;
    let transactionSubject: string | undefined;
    let storedCommand: LocalLegalWriteCommand | undefined;
    const write = createProposedBoundLocalLegalTransaction({
      verifyAuth: async () => verified,
      readAccount: async (subject) => { roleLookupSubject = subject; return ownAccount(); },
      serverNowMs: () => NOW,
      withSubjectTransaction: async (subject, operation) => {
        transactionSubject = subject;
        const appendOnce: LocalLegalAppendOnce = async (command) => {
          storedCommand = command;
          return { status: "appended", audit: {
            eventSeq: "1", eventId: "99999999-9999-4999-8999-999999999999",
            userId: command.userId, idempotencyKey: command.idempotencyKey,
            eventKind: command.eventKind, termsVersion: command.termsVersion,
            privacyNoticeVersion: command.privacyNoticeVersion,
            recordedAt: "2026-11-13T03:00:00.000000Z",
          } };
        };
        return operation(appendOnce);
      },
    });
    expect((await write("accept", KEY)).status).toBe("appended");
    expect(roleLookupSubject).toBe(USER);
    expect(transactionSubject).toBe(USER);
    expect(storedCommand).toMatchObject({ userId: USER, idempotencyKey: KEY,
      termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
      privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion });
  });

  it("denies malformed, cross-user, blocked, expired and unauthorized contexts before a transaction", async () => {
    let transactions = 0;
    let lookups = 0;
    const contexts: Array<{ auth: VerifiedAssistantAuthContext | null; account: ReturnType<typeof ownAccount> | null }> = [
      { auth: null, account: ownAccount() },
      { auth: { ...verified, userId: "not-a-uuid" }, account: ownAccount() },
      { auth: { ...verified, claims: { sub: OTHER, exp: verified.claims.exp } }, account: ownAccount() },
      { auth: { ...verified, claims: { sub: USER, exp: Math.floor(NOW / 1000) } }, account: ownAccount() },
      { auth: verified, account: { ...ownAccount(), isActive: false } },
      { auth: verified, account: { ...ownAccount(), userId: OTHER } },
      { auth: verified, account: { ...ownAccount(), roleRows: [{ role: "visitante" }] } },
    ];
    for (const c of contexts) {
      const write = createProposedBoundLocalLegalTransaction({
        verifyAuth: async () => c.auth,
        readAccount: async () => { lookups++; return c.account; },
        serverNowMs: () => NOW,
        withSubjectTransaction: async () => { transactions++; return { status: "unavailable" }; },
      });
      expect(await write("accept", KEY)).toEqual({ status: "denied" });
    }
    expect(transactions).toBe(0);
    expect(lookups).toBe(4);
  });

  it("requires rollback on malformed storage audit and on storage failure", async () => {
    let rolledBack = 0;
    let committed = 0;
    const operation = createProposedBoundLocalLegalTransaction({
      verifyAuth: async () => verified,
      readAccount: async () => ownAccount(),
      serverNowMs: () => NOW,
      withSubjectTransaction: async (_subject, run) => {
        try {
          const result = await run(async (command) => ({ status: "appended", audit: {
            eventSeq: "1", eventId: "not-a-real-uuid", userId: command.userId,
            idempotencyKey: command.idempotencyKey, eventKind: command.eventKind,
            termsVersion: command.termsVersion, privacyNoticeVersion: command.privacyNoticeVersion,
            recordedAt: "2026-11-13T03:00:00.000000Z",
          } }));
          committed++;
          return result;
        } catch (error) {
          rolledBack++;
          throw error;
        }
      },
    });
    expect(await operation("accept", KEY)).toEqual({ status: "unavailable" });
    expect(rolledBack).toBe(1);
    expect(committed).toBe(0);

    const failedStorage = createProposedBoundLocalLegalTransaction({
      verifyAuth: async () => verified,
      readAccount: async () => ownAccount(),
      serverNowMs: () => NOW,
      withSubjectTransaction: async (_subject, run) => {
        try {
          const result = await run(async () => { throw new Error("synthetic DB failure"); });
          committed++;
          return result;
        } catch (error) {
          rolledBack++;
          throw error;
        }
      },
    });
    expect(await failedStorage("accept", KEY)).toEqual({ status: "unavailable" });
    expect(rolledBack).toBe(2);
    expect(committed).toBe(0);
  });

  it("denies a session expiring during role lookup before calling the writer", async () => {
    let timeCalls = 0;
    let appendCalls = 0;
    const write = createProposedBoundLocalLegalTransaction({
      verifyAuth: async () => verified,
      readAccount: async () => ownAccount(),
      serverNowMs: () => { timeCalls++; return timeCalls === 1 ? NOW : NOW + 120_000; },
      withSubjectTransaction: async (_userId, operation) => operation(async () => {
        appendCalls++;
        return { status: "unavailable" };
      }),
    });
    expect((await write("accept", KEY)).status).toBe("denied");
    expect(appendCalls).toBe(0);
  });
});
