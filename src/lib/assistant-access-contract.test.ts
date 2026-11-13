import { describe, expect, it } from "vitest";
import {
  ASSISTANT_LEGAL_POLICY,
  decideAssistantAccess,
  type StoredAssistantLegalAcceptance,
  type TrustedAssistantSession,
} from "./assistant-access-contract";
import { LEGAL_UPDATED_AT } from "./legal-documents";

// Only fixtures: no hosted database, no auth token and no real customer data.
const NOW = Date.parse("2026-11-13T03:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function session(override: Partial<TrustedAssistantSession> = {}): TrustedAssistantSession {
  return {
    userId: USER_ID,
    roles: ["cliente"],
    expiresAtMs: NOW + 60_000,
    ...override,
  };
}

function accepted(override: Partial<StoredAssistantLegalAcceptance> = {}): StoredAssistantLegalAcceptance {
  return {
    userId: USER_ID,
    termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
    privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
    acceptedAt: "2026-11-13T02:00:00.000Z",
    ...override,
  };
}

describe("assistant access: offline fail-closed server contract (Issue #261)", () => {
  it("ties the versioned contract to the currently published legal document date", () => {
    expect(ASSISTANT_LEGAL_POLICY.publishedAt).toBe(LEGAL_UPDATED_AT);
    expect(ASSISTANT_LEGAL_POLICY.publishedAt).toBe("11 de novembro de 2026");
  });

  it("rejects anonymous access even when a stored acceptance row is supplied", () => {
    expect(decideAssistantAccess(null, accepted(), NOW)).toEqual({
      allowed: false, reason: "authentication_required",
    });
  });

  it("rejects invalid identity or expired verified session", () => {
    expect(decideAssistantAccess(session({ userId: "visitor" }), accepted(), NOW)).toEqual({
      allowed: false, reason: "authentication_required",
    });
    expect(decideAssistantAccess(session({ expiresAtMs: NOW }), accepted(), NOW)).toEqual({
      allowed: false, reason: "authentication_required",
    });
  });

  it("rejects unknown or missing roles rather than trusting arbitrary client role flags", () => {
    for (const roles of [[], ["visitor"], ["pending"]]) {
      expect(decideAssistantAccess(session({ roles }), accepted(), NOW)).toEqual({
        allowed: false, reason: "role_not_permitted",
      });
    }
  });

  it("does not accept a client-side checkbox as stored legal evidence", () => {
    // Intentionally malformed input models { termsAccepted: true } sent by the browser.
    const uiOnly = { termsAccepted: true } as unknown as StoredAssistantLegalAcceptance;
    expect(decideAssistantAccess(session(), uiOnly, NOW)).toEqual({
      allowed: false, reason: "acceptance_required",
    });
    expect(decideAssistantAccess(session(), null, NOW)).toEqual({
      allowed: false, reason: "acceptance_required",
    });
  });

  it("rejects an acceptance belonging to a different authenticated user", () => {
    expect(decideAssistantAccess(session(), accepted({ userId: OTHER_ID }), NOW)).toEqual({
      allowed: false, reason: "acceptance_required",
    });
  });

  it("rejects an outdated terms or privacy notice version", () => {
    for (const update of [
      { termsVersion: "eut-termos-2025-01-01" },
      { privacyNoticeVersion: "eut-privacidade-2025-01-01" },
    ]) {
      expect(decideAssistantAccess(session(), accepted(update), NOW)).toEqual({
        allowed: false, reason: "acceptance_required",
      });
    }
  });

  it("rejects malformed or future-dated acceptance timestamps", () => {
    for (const acceptedAt of ["", "not-a-date", "2026-11-14T02:00:00.000Z"]) {
      expect(decideAssistantAccess(session(), accepted({ acceptedAt }), NOW)).toEqual({
        allowed: false, reason: "acceptance_required",
      });
    }
  });

  it("accepts a matching, unexpired and server-verified client account with persisted evidence", () => {
    expect(decideAssistantAccess(session(), accepted(), NOW)).toEqual({
      allowed: true,
      userId: USER_ID,
      termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
      privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
    });
  });

  it("supports the existing tecnico and admin roles without creating new privileges", () => {
    for (const role of ["tecnico", "admin"]) {
      expect(decideAssistantAccess(session({ roles: [role] }), accepted(), NOW).allowed).toBe(true);
    }
  });
});
