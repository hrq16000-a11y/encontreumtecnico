import { describe, expect, it } from "vitest";
import { ASSISTANT_LEGAL_POLICY } from "./assistant-access-contract";
import { createProposedLocalPgAppendOnceDriver } from "./assistant-legal-pg-appendonce-driver-proposal.server";
import {
  createProposedLocalPgSubjectTransaction,
  type LocalPgClient,
} from "./assistant-legal-pg-transaction-proposal.server";

/** No PostgreSQL client: every query below is an in-memory synthetic response. */
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GOOD_ROLE = {
  effective_role: "eut_legal_local_writer", effective_superuser: false,
  effective_bypassrls: false, login_superuser: false, login_bypassrls: false,
};
const COMMAND = {
  userId: SUBJECT, idempotencyKey: KEY, eventKind: "accept" as const,
  termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
  privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
};

function fakeClient(config: {
  role?: Record<string, unknown>;
  operational?: boolean;
  subject?: string;
  missingOperationalFunction?: boolean;
  appendFailure?: boolean;
} = {}) {
  const calls: Array<{ sql: string; params?: readonly unknown[] }> = [];
  let releases = 0;
  const client: LocalPgClient = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes("FROM pg_catalog.pg_roles")) {
        return { rows: [config.role ?? GOOD_ROLE] };
      }
      if (sql.includes("auth.uid()::text")) {
        return { rows: [{ verified_subject: config.subject ?? SUBJECT }] };
      }
      if (sql.includes("public.eut_account_operational()")) {
        if (config.missingOperationalFunction) throw new Error("undefined_function");
        return { rows: [{ operational: config.operational ?? true }] };
      }
      if (sql.includes("eut_assistant_legal.append_once_local")) {
        if (config.appendFailure) throw new Error("synthetic_write_error");
        return { rows: [{ status: "appended", event_seq: "1",
          event_id: "99999999-9999-4999-8999-999999999999",
          user_id: SUBJECT, idempotency_key: KEY, event_kind: "accept",
          terms_version: COMMAND.termsVersion,
          privacy_notice_version: COMMAND.privacyNoticeVersion,
          recorded_at: "2026-11-13T03:00:00.000000Z",
        }] };
      }
      return { rows: [] };
    },
    release: () => { releases++; },
  };
  return { client, calls, get releases() { return releases; } };
}

describe("#261 synthetic non-BYPASSRLS subject transaction", () => {
  it("runs one bounded transaction, verifies role/account, and calls existing appendOnce", async () => {
    const f = fakeClient();
    const transact = createProposedLocalPgSubjectTransaction({ connect: async () => f.client });
    const result = await transact(SUBJECT, (query) =>
      createProposedLocalPgAppendOnceDriver(query)(COMMAND));
    expect(result.status).toBe("appended");
    expect(f.calls.map(x => x.sql.trim())).toEqual([
      "BEGIN", "SET LOCAL ROLE eut_legal_local_writer",
      expect.stringContaining("FROM pg_catalog.pg_roles"),
      "SELECT pg_catalog.set_config('request.jwt.claim.sub', $1::text, true)",
      "SELECT auth.uid()::text AS verified_subject",
      "SELECT public.eut_account_operational() AS operational",
      expect.stringContaining("eut_assistant_legal.append_once_local"),
      "COMMIT",
    ]);
    expect(f.calls[3].params).toEqual([SUBJECT]);
    expect(f.calls[6].params).toEqual([
      SUBJECT, KEY, "accept", COMMAND.termsVersion, COMMAND.privacyNoticeVersion,
    ]);
    expect(f.calls.some(x => x.sql === "ROLLBACK")).toBe(false);
    expect(f.releases).toBe(1);
  });

  it("rolls back for bypass roles, mismatched subject, blocked account or missing RPC", async () => {
    for (const scenario of [
      { role: { ...GOOD_ROLE, effective_bypassrls: true } },
      { role: { ...GOOD_ROLE, login_superuser: true } },
      { subject: "22222222-2222-4222-8222-222222222222" },
      { operational: false },
      { missingOperationalFunction: true },
    ]) {
      const f = fakeClient(scenario);
      const transact = createProposedLocalPgSubjectTransaction({ connect: async () => f.client });
      await expect(transact(SUBJECT, (query) =>
        createProposedLocalPgAppendOnceDriver(query)(COMMAND))).rejects.toThrow();
      expect(f.calls.some(x => x.sql.includes("eut_assistant_legal.append_once_local"))).toBe(false);
      expect(f.calls.map(x => x.sql).slice(-1)).toEqual(["ROLLBACK"]);
      expect(f.releases).toBe(1);
    }
  });

  it("rolls back on failed storage and rejects malformed subjects before connecting", async () => {
    const f = fakeClient({ appendFailure: true });
    let connects = 0;
    const transact = createProposedLocalPgSubjectTransaction({ connect: async () => {
      connects++; return f.client;
    } });
    await expect(transact("client supplied id", async () => ({ status: "appended",
      audit: { eventId: "x", eventSeq: "1", recordedAt: "x" },
    }))).rejects.toThrow("unverified_legal_subject");
    expect(connects).toBe(0);
    await expect(transact(SUBJECT, (query) =>
      createProposedLocalPgAppendOnceDriver(query)(COMMAND))).rejects.toThrow(
      "abort_untrusted_legal_transaction",
    );
    expect(f.calls.at(-1)?.sql).toBe("ROLLBACK");
    expect(f.releases).toBe(1);
  });
});
