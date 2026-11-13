import { describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_LEGAL_POLICY,
  type TrustedAssistantSession,
} from "./assistant-access-contract";
import {
  decideAssistantAccessAfterLegalRead,
  type AssistantLegalEvidenceRead,
} from "./assistant-legal-evidence-gate";

// Synthetic fixtures only: no tokens, hosted database, real accounts or AI.
const NOW = Date.parse("2026-11-13T03:00:00.000Z");
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const principal = (overrides: Partial<TrustedAssistantSession> = {}): TrustedAssistantSession => ({
  userId: USER, roles: ["cliente"], expiresAtMs: NOW + 60_000, ...overrides,
});
const found = (overrides: Record<string, unknown> = {}): AssistantLegalEvidenceRead => ({
  state: "found",
  row: {
    userId: USER,
    termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
    privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
    acceptedAt: "2026-11-13T02:00:00.000Z",
    revokedAt: null,
    ...overrides,
  },
});
const denied = { allowed: false, reason: "acceptance_required" };

describe("assistant legal evidence read boundary — offline #261", () => {
  it("does not read storage for missing, expired or unauthorized principals", async () => {
    const read = vi.fn(async () => found());
    expect(await decideAssistantAccessAfterLegalRead(null, read, NOW)).toEqual({
      allowed: false, reason: "authentication_required",
    });
    expect(await decideAssistantAccessAfterLegalRead(principal({ expiresAtMs: NOW }), read, NOW)).toEqual({
      allowed: false, reason: "authentication_required",
    });
    expect(await decideAssistantAccessAfterLegalRead(principal({ roles: ["visitor"] }), read, NOW)).toEqual({
      allowed: false, reason: "role_not_permitted",
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("denies absent or unavailable records", async () => {
    for (const state of ["missing", "unavailable"] as const) {
      expect(await decideAssistantAccessAfterLegalRead(principal(), async () => ({ state }), NOW))
        .toEqual(denied);
    }
  });

  it("fails closed when the authorized reader rejects or returns malformed evidence", async () => {
    expect(await decideAssistantAccessAfterLegalRead(principal(), async () => {
      throw new Error("storage unavailable");
    }, NOW)).toEqual(denied);
    expect(await decideAssistantAccessAfterLegalRead(
      principal(),
      async () => ({ state: "found", row: { termsAccepted: true } } as unknown as AssistantLegalEvidenceRead),
      NOW,
    )).toEqual(denied);
  });

  it("rejects any revoked or unknown revocation state", async () => {
    for (const revokedAt of ["2026-11-13T02:30:00.000Z", undefined, ""]) {
      expect(await decideAssistantAccessAfterLegalRead(principal(), async () => found({ revokedAt }), NOW))
        .toEqual(denied);
    }
  });

  it("rejects a record for another subject, even if otherwise current", async () => {
    expect(await decideAssistantAccessAfterLegalRead(principal(), async () => found({ userId: OTHER }), NOW))
      .toEqual(denied);
  });

  it("rejects stale versions and untrusted acceptance timestamps", async () => {
    for (const override of [
      { termsVersion: "eut-termos-old" },
      { privacyNoticeVersion: "eut-privacidade-old" },
      { acceptedAt: "2026-11-14T00:00:00.000Z" },
    ]) {
      expect(await decideAssistantAccessAfterLegalRead(principal(), async () => found(override), NOW))
        .toEqual(denied);
    }
  });

  it("allows only a current, non-revoked row scoped to the verified subject", async () => {
    const read = vi.fn(async () => found());
    expect(await decideAssistantAccessAfterLegalRead(principal(), read, NOW)).toEqual({
      allowed: true,
      userId: USER,
      termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
      privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
    });
    expect(read).toHaveBeenCalledExactlyOnceWith(USER);
  });
});
