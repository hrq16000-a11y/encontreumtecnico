import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProposedBoundLocalLegalTransaction,
  type WithLocalAssistantSubjectTransaction,
} from "./assistant-legal-transaction-binding-proposal.server";
import {
  createProposedLocalPgAppendOnceDriver,
  type LocalLegalPgQuery,
} from "./assistant-legal-pg-appendonce-driver-proposal.server";
import type { LocalLegalWriteResult } from "./assistant-legal-ledger-local-writer-proposal.server";
import type { VerifiedAssistantAuthContext } from "./assistant-verified-auth-context";

/**
 * Issue #261 — INERT composition for the EXISTING requireSupabaseAuth context.
 * A future server function MUST use
 *   .middleware([requireSupabaseAuth])
 * from ../integrations/supabase/auth-middleware and pass ONLY its verified
 * server context here. This function is not a route and is never invoked by AI.
 * No Supabase request or PostgreSQL connection happens upon construction.
 * The generated middleware verifies claims but does not prove account status.
 */
export type RequiredSupabaseAuthContextForLocalLegal = Readonly<
  VerifiedAssistantAuthContext & { supabase: Pick<SupabaseClient, "from"> }
>;

export type LocalLegalVerifiedPgTransaction = (
  verifiedSubject: string,
  operation: (transactionQuery: LocalLegalPgQuery) => Promise<LocalLegalWriteResult>,
) => Promise<LocalLegalWriteResult>;

export type LocalLegalServerBindings = Readonly<{
  /** Authoritative operational account block/status check, NOT browser metadata. */
  isActiveAccount: (verifiedSubject: string) => Promise<boolean>;
  /** Must BEGIN, SET LOCAL verified auth.uid(), enforce RLS and rollback errors. */
  withVerifiedPgTransaction: LocalLegalVerifiedPgTransaction;
  serverNowMs: () => number;
}>;

/**
 * Uses the auth-bound Supabase client for existing `user_roles` read.
 * `supabaseAdmin` (service-role BYPASSRLS) MUST NOT supply this client or tx.
 * Active-account verification and a non-BYPASSRLS transactional connection
 * have no versioned live implementations; keep these REQUIRED dependencies.
 * Returning null/unavailable from any dependency fails closed.
 */
export function createProposedLocalLegalBindingFromRequiredAuth(
  context: RequiredSupabaseAuthContextForLocalLegal,
  dependencies: LocalLegalServerBindings,
) {
  const withSubjectTransaction: WithLocalAssistantSubjectTransaction =
    (verifiedSubject, operation) =>
      dependencies.withVerifiedPgTransaction(verifiedSubject, (query) =>
        operation(createProposedLocalPgAppendOnceDriver(query)));

  return createProposedBoundLocalLegalTransaction({
    verifyAuth: async () => ({ userId: context.userId, claims: context.claims }),
    readAccount: async (verifiedSubject) => {
      // No default status; absence, suspension or unavailability means denial.
      const active = await dependencies.isActiveAccount(verifiedSubject);
      if (active !== true) return null;

      const { data, error } = await context.supabase.from("user_roles")
        .select("role").eq("user_id", verifiedSubject);
      if (error || !Array.isArray(data)) return null;
      return { userId: verifiedSubject, isActive: true, roleRows: data };
    },
    withSubjectTransaction,
    serverNowMs: dependencies.serverNowMs,
  });
}
