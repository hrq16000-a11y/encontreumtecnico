import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSISTANT_LEGAL_POLICY } from "./assistant-access-contract";
import {
  createProposedLocalLegalBindingFromRequiredAuth,
  type RequiredSupabaseAuthContextForLocalLegal,
} from "./assistant-legal-auth-supabase-binding-proposal.server";

/** Synthetic middleware context, account check and PG transaction; no network. */
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = Date.parse("2026-11-13T04:00:00.000Z");

function mockAuthContext(
  roleQuery: (subject: string) => Promise<{ data: unknown; error: unknown }>,
  sub = SUBJECT,
): RequiredSupabaseAuthContextForLocalLegal {
  const supabase = {
    from: (table: string) => {
      if (table !== "user_roles") throw new Error("unexpected table");
      return {
        select: (columns: string) => {
          if (columns !== "role") throw new Error("unexpected columns");
          return { eq: (column: string, subject: string) => {
            if (column !== "user_id") throw new Error("unexpected role predicate");
            return roleQuery(subject);
          } };
        },
      };
    },
  } as unknown as Pick<SupabaseClient, "from">;
  return { userId: SUBJECT, claims: { sub, exp: Math.floor((NOW + 60_000) / 1000) }, supabase };
}

describe("#261 inert requireSupabaseAuth -> roles -> appendOnce binding", () => {
  it("reads server roles for exactly the verified subject, then binds PG params", async () => {
    const calls: string[] = [];
    const context = mockAuthContext(async (subject) => {
      calls.push(`roles:${subject}`);
      return { data: [{ role: "cliente" }], error: null };
    });
    const write = createProposedLocalLegalBindingFromRequiredAuth(context, {
      isActiveAccount: async (id) => { calls.push(`active:${id}`); return true; },
      serverNowMs: () => NOW,
      withVerifiedPgTransaction: async (id, operation) => {
        calls.push(`transaction:${id}`);
        return operation(async (sql, params) => {
          expect(sql).toContain("eut_assistant_legal.append_once_local");
          expect(params).toEqual([SUBJECT, KEY, "accept",
            ASSISTANT_LEGAL_POLICY.termsVersion,
            ASSISTANT_LEGAL_POLICY.privacyNoticeVersion]);
          return { rows: [{ status: "appended", event_seq: "1",
            event_id: "99999999-9999-4999-8999-999999999999", user_id: SUBJECT,
            idempotency_key: KEY, event_kind: "accept",
            terms_version: ASSISTANT_LEGAL_POLICY.termsVersion,
            privacy_notice_version: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
            recorded_at: "2026-11-13T03:00:00.000000Z",
          }] };
        });
      },
    });
    expect((await write("accept", KEY)).status).toBe("appended");
    expect(calls).toEqual([`active:${SUBJECT}`, `roles:${SUBJECT}`, `transaction:${SUBJECT}`]);
  });

  it("fails closed before a transaction for blocked, missing roles or spoofed claims", async () => {
    let roleQueries = 0;
    let transactions = 0;
    const context = mockAuthContext(async () => {
      roleQueries++;
      return { data: null, error: { message: "synthetic role query failure" } };
    });
    const transaction = async () => {
      transactions++;
      throw new Error("must not reach transaction");
    };
    const blocked = createProposedLocalLegalBindingFromRequiredAuth(context, {
      isActiveAccount: async () => false,
      withVerifiedPgTransaction: transaction,
      serverNowMs: () => NOW,
    });
    expect(await blocked("accept", KEY)).toEqual({ status: "denied" });
    expect(roleQueries).toBe(0);

    const missingRoles = createProposedLocalLegalBindingFromRequiredAuth(context, {
      isActiveAccount: async () => true,
      withVerifiedPgTransaction: transaction,
      serverNowMs: () => NOW,
    });
    expect(await missingRoles("accept", KEY)).toEqual({ status: "denied" });
    expect(roleQueries).toBe(1);

    const spoofed = createProposedLocalLegalBindingFromRequiredAuth(
      mockAuthContext(async () => { roleQueries++; return { data: [{ role: "admin" }], error: null }; }, OTHER), {
        isActiveAccount: async () => { throw new Error("should not read account"); },
        withVerifiedPgTransaction: transaction,
        serverNowMs: () => NOW,
      });
    expect(await spoofed("accept", KEY)).toEqual({ status: "denied" });
    expect(roleQueries).toBe(1);
    expect(transactions).toBe(0);
  });
});
