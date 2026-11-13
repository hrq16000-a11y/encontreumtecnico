import { decideAssistantAccess, type TrustedAssistantSession } from "./assistant-access-contract";
import {
  createProposedLocalAssistantLegalWriter,
  type LocalLegalAppendOnce,
  type LocalLegalEventKind,
  type LocalLegalWriteResult,
} from "./assistant-legal-ledger-local-writer-proposal.server";

/**
 * Issue #261 — inert server-only composition contract, never an HTTP endpoint.
 * No client state, request body, cookies decoded without verification, DB driver,
 * Supabase call, AI integration or production credential exists in this module.
 *
 * The future server adapter must IMPLEMENT verifySession with a trusted Auth
 * verifier, and resolveAccount with an authoritative account-status + role read.
 * The role read must honor administrative blocks, not user-editable metadata.
 * Bind the local SQL writer's auth.uid() claim to that SAME verified subject on
 * its database transaction; this pure boundary does not establish DB identity.
 */
export type VerifiedAssistantIdentity = Readonly<{
  userId: string;
  expiresAtMs: number;
}>;

export type AuthorizedAssistantAccount = Readonly<{
  userId: string;
  isActive: boolean;
  roles: readonly string[];
}>;

export type VerifyAssistantSessionOnServer = () => Promise<VerifiedAssistantIdentity | null>;
export type ReadAuthorizedAssistantAccountOnServer = (
  verifiedUserId: string,
) => Promise<AuthorizedAssistantAccount | null>;

export type ProposedAssistantLegalServerDependencies = Readonly<{
  verifySession: VerifyAssistantSessionOnServer;
  readAccount: ReadAuthorizedAssistantAccountOnServer;
  appendOnce: LocalLegalAppendOnce;
}>;

/**
 * The request-facing function accepts ONLY intent, key and server clock.
 * It cannot accept a claimed userId, account flag or roles from the browser.
 * Every call obtains a fresh verified subject and an account snapshot for it.
 * This is a fixture-friendly design proposal; no real storage is connected.
 */
export function createProposedSessionBoundAssistantLegalWriter(
  dependencies: ProposedAssistantLegalServerDependencies,
) {
  const write = createProposedLocalAssistantLegalWriter(dependencies.appendOnce);
  return async (
    eventKind: LocalLegalEventKind,
    idempotencyKey: string,
    nowMs: number,
  ): Promise<LocalLegalWriteResult> => {
    if (!Number.isFinite(nowMs)) return { status: "denied" };

    try {
      const identity = await dependencies.verifySession();
      if (!identity || typeof identity.userId !== "string" ||
          !Number.isFinite(identity.expiresAtMs) || identity.expiresAtMs <= nowMs) {
        return { status: "denied" };
      }

      const account = await dependencies.readAccount(identity.userId);
      if (!account || account.isActive !== true ||
          typeof account.userId !== "string" ||
          account.userId.toLowerCase() !== identity.userId.toLowerCase() ||
          !Array.isArray(account.roles) ||
          !account.roles.every((role) => typeof role === "string")) {
        return { status: "denied" };
      }

      const principal: TrustedAssistantSession = Object.freeze({
        userId: identity.userId,
        expiresAtMs: identity.expiresAtMs,
        roles: Object.freeze([...account.roles]),
      });
      // Reuse the canonical versioned eligibility gate; never infer roles.
      const decision = decideAssistantAccess(principal, null, nowMs);
      if (decision.allowed || decision.reason !== "acceptance_required") {
        return { status: "denied" };
      }
      return write(principal, eventKind, idempotencyKey, nowMs);
    } catch {
      // Auth/role lookup errors cannot produce an acceptance or authorization.
      return { status: "unavailable" };
    }
  };
}
