import {
  assistantPrincipalFromVerifiedContext,
  type ServerAuthorizedRoleRow,
  type VerifiedAssistantAuthContext,
} from "./assistant-verified-auth-context";
import {
  createProposedLocalAssistantLegalWriter,
  type LocalLegalAppendOnce,
  type LocalLegalEventKind,
  type LocalLegalWriteResult,
} from "./assistant-legal-ledger-local-writer-proposal.server";

/**
 * Issue #261 — INERT server-only composition, not a route or a DB connection.
 * All capabilities below must be supplied by a future trusted server handler:
 * - verifyAuth: signature/session/revocation verified by requireSupabaseAuth;
 * - readAccount: private account status + role rows for the verified subject;
 * - withSubjectTransaction: single DB transaction with SET LOCAL identity,
 *   non-BYPASSRLS writer role, auth.uid() matching the verified subject and
 *   rollback on ANY callback throw. Never use a service-role/BYPASSRLS shortcut.
 * Neither request JSON, JWT metadata, browser role state nor a raw token may
 * implement these capabilities. There is NO live implementation in this file.
 */
export type LocalAuthorizedAccountSnapshot = Readonly<{
  userId: string;
  isActive: boolean;
  roleRows: readonly ServerAuthorizedRoleRow[];
}>;

export type WithLocalAssistantSubjectTransaction = (
  verifiedUserId: string,
  operation: (appendOnce: LocalLegalAppendOnce) => Promise<LocalLegalWriteResult>,
) => Promise<LocalLegalWriteResult>;

export type ProposedLocalLegalTransactionDependencies = Readonly<{
  verifyAuth: () => Promise<VerifiedAssistantAuthContext | null>;
  readAccount: (verifiedUserId: string) => Promise<LocalAuthorizedAccountSnapshot | null>;
  withSubjectTransaction: WithLocalAssistantSubjectTransaction;
  serverNowMs: () => number;
}>;

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

/**
 * Only legal intent and idempotency key enter the request-facing operation.
 * Subject, role, active status, version and database role are not parameters.
 * A successful receipt is NOT assistant access; the reader still gates usage.
 */
export function createProposedBoundLocalLegalTransaction(
  dependencies: ProposedLocalLegalTransactionDependencies,
) {
  return async (
    eventKind: LocalLegalEventKind,
    idempotencyKey: string,
  ): Promise<LocalLegalWriteResult> => {
    try {
      const verified = await dependencies.verifyAuth();
      if (!verified || typeof verified.userId !== "string" ||
          !UUID.test(verified.userId) || typeof verified.claims?.sub !== "string" ||
          verified.claims.sub.toLowerCase() !== verified.userId.toLowerCase()) {
        return { status: "denied" };
      }

      const account = await dependencies.readAccount(verified.userId);
      if (!account || account.isActive !== true ||
          typeof account.userId !== "string" ||
          account.userId.toLowerCase() !== verified.userId.toLowerCase()) {
        return { status: "denied" };
      }

      const nowMs = dependencies.serverNowMs();
      const principal = assistantPrincipalFromVerifiedContext(
        verified, account.roleRows, nowMs,
      );
      if (!principal) return { status: "denied" };

      return await dependencies.withSubjectTransaction(principal.userId, async (appendOnce) => {
        // Recheck expiry just before the database operation; time cannot come
        // from a caller-controlled request body.
        const currentNowMs = dependencies.serverNowMs();
        const write = createProposedLocalAssistantLegalWriter(appendOnce);
        const result = await write(principal, eventKind, idempotencyKey, currentNowMs);
        // A driver error or malformed audit may happen after INSERT; force the
        // transaction owner to roll back rather than committing unknown state.
        if (result.status === "unavailable") throw new Error("abort_untrusted_legal_audit");
        return result;
      });
    } catch {
      // Auth lookup, transaction and rollback errors never grant acceptance.
      return { status: "unavailable" };
    }
  };
}
