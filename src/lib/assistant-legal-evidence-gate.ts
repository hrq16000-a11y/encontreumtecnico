import {
  decideAssistantAccess,
  type AssistantAccessDecision,
  type StoredAssistantLegalAcceptance,
  type TrustedAssistantSession,
} from "./assistant-access-contract";

/**
 * Offline-only boundary for a future SERVER-authorized legal-evidence lookup.
 *
 * No storage is configured here. A future handler must first verify the session,
 * account status and roles, then query a private ledger scoped to that user.
 * Never provide this reader from browser state, request JSON or a checkbox.
 * The authoritative lookup must account for revocations and read failures.
 */
export type AssistantLegalEvidenceRow = StoredAssistantLegalAcceptance & {
  /** Explicit null is required; missing/unknown revocation state denies access. */
  revokedAt: string | null;
};

export type AssistantLegalEvidenceRead =
  | { state: "found"; row: AssistantLegalEvidenceRow }
  | { state: "missing" | "unavailable" };

export type ReadAuthorizedAssistantLegalEvidence = (
  verifiedUserId: string,
) => Promise<AssistantLegalEvidenceRead>;

/**
 * Pure policy + injected read, NOT an active assistant endpoint or DB adapter.
 * The only successful path still requires decideAssistantAccess to check
 * identity, roles, expiry, exact document versions and acceptance timestamp.
 */
export async function decideAssistantAccessAfterLegalRead(
  principal: TrustedAssistantSession | null,
  readAuthorizedEvidence: ReadAuthorizedAssistantLegalEvidence,
  nowMs: number,
): Promise<AssistantAccessDecision> {
  const denial = decideAssistantAccess(principal, null, nowMs);
  if (denial.allowed || denial.reason !== "acceptance_required" || !principal) {
    return denial;
  }

  try {
    const result = await readAuthorizedEvidence(principal.userId);
    if (result?.state !== "found" || !result.row || result.row.revokedAt !== null) {
      return denial;
    }

    // Pass only the legal fields to the existing, versioned fail-closed guard.
    const { userId, termsVersion, privacyNoticeVersion, acceptedAt } = result.row;
    return decideAssistantAccess(
      principal,
      { userId, termsVersion, privacyNoticeVersion, acceptedAt },
      nowMs,
    );
  } catch {
    // Query error/timeout rejection never becomes an implicit authorization.
    return denial;
  }
}
