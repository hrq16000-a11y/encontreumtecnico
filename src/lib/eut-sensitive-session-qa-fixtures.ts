/**
 * PR #145: synthetic QA inputs only. Not an Auth emulator, SQL runner or
 * database fixture. These cases specify the contract to verify in isolated E2E.
 * Never use real user IDs, phones, emails or production credentials here.
 */
const owner = "00000000-0000-4000-8000-000000000101";
const other = "00000000-0000-4000-8000-000000000102";

export const noJwtWriteTargets = [
  "public.technicians",
  "public.eut_technician_presence",
  "public.eut_direct_request_replies",
  "public.eut_direct_request_consents",
  "public.eut_technician_referrals",
] as const;

export const sessionCases = [
  { id: "valid", actor: owner, jwtSession: "qa-session-1", storedSessions: ["qa-session-1"], banned: false, expected: true },
  { id: "revoked-jwt-still-present", actor: owner, jwtSession: "qa-session-1", storedSessions: [], banned: false, expected: false },
  { id: "session-of-different-user", actor: owner, jwtSession: "qa-session-other", storedSessions: ["qa-session-1"], banned: false, expected: false },
  { id: "restricted-account", actor: owner, jwtSession: "qa-session-1", storedSessions: ["qa-session-1"], banned: true, expected: false },
  { id: "no-jwt-internal", actor: null, jwtSession: null, storedSessions: [], banned: false, expected: false },
] as const;

// The only intended exception to an invalid session is placing one's OWN
// presence offline. All unrelated fields must remain unchanged.
export const revokedOfflineCases = [
  { id: "owner-offline-only", actor: owner, oldRow: { user_id: owner, available: true, note: "original" }, newRow: { user_id: owner, available: false, note: "original" }, expected: true },
  { id: "offline-and-modify-other-column", actor: owner, oldRow: { user_id: owner, available: true, note: "original" }, newRow: { user_id: owner, available: false, note: "changed" }, expected: false },
  { id: "offline-on-other-owner", actor: other, oldRow: { user_id: owner, available: true, note: "original" }, newRow: { user_id: owner, available: false, note: "original" }, expected: false },
  { id: "transfer-ownership", actor: owner, oldRow: { user_id: owner, available: true, note: "original" }, newRow: { user_id: other, available: false, note: "original" }, expected: false },
  { id: "turn-online", actor: owner, oldRow: { user_id: owner, available: false, note: "original" }, newRow: { user_id: owner, available: true, note: "original" }, expected: false },
  { id: "no-jwt-cannot-offline", actor: null, oldRow: { user_id: owner, available: true, note: "original" }, newRow: { user_id: owner, available: false, note: "original" }, expected: false },
] as const;

export const rollbackInventory = {
  functions: [
    "eut_moderation.subject_operational",
    "public.eut_sensitive_session_active",
    "eut_moderation.guard_sensitive_write",
  ],
  policies: [
    "eut_session_private_requests",
    "eut_session_direct_consents",
    "eut_session_legacy_claims_read",
    "eut_session_legacy_claims_create",
    "eut_session_technician_updates",
  ],
  triggers: [
    "eut_active_session_tech_write",
    "eut_active_session_presence",
    "eut_active_session_reply",
    "eut_active_session_sharing",
    "eut_active_session_referral",
  ],
  priorStateToCapture: ["existence", "definition", "owner", "privileges", "dependencies"],
} as const;
