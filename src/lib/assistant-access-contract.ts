import { LEGAL_UPDATED_AT } from "./legal-documents";
import type { Role } from "../hooks/use-auth";

/**
 * Offline policy contract for the future authenticated assistant (#261).
 *
 * NOT an active authorization gate. Never populate `principal` or `acceptance`
 * from an HTTP request body, client-side useAuth, cookie contents or a checkbox.
 * A future server handler must verify the user with Supabase Auth, obtain roles
 * and acceptance evidence from server-authorized storage, then call this guard
 * BEFORE persisting a message or invoking the AI gateway.
 *
 * The version identifiers intentionally do not change automatically when the
 * legal copy changes: a legal update requires a reviewed version bump and
 * corresponding reacceptance. The test ties the baseline to LEGAL_UPDATED_AT.
 */
export const ASSISTANT_LEGAL_POLICY = {
  termsVersion: "eut-termos-2026-11-11",
  privacyNoticeVersion: "eut-privacidade-2026-11-11",
  publishedAt: LEGAL_UPDATED_AT,
} as const;

/** Trusted input ONLY after a backend has verified the Auth session + roles. */
export type TrustedAssistantSession = {
  userId: string;
  roles: readonly string[];
  expiresAtMs: number;
};

/** Evidence read from private, server-authorized storage; never client input. */
export type StoredAssistantLegalAcceptance = {
  userId: string;
  termsVersion: string;
  privacyNoticeVersion: string;
  acceptedAt: string;
};

export type AssistantAccessDecision =
  | {
      allowed: true;
      userId: string;
      termsVersion: typeof ASSISTANT_LEGAL_POLICY.termsVersion;
      privacyNoticeVersion: typeof ASSISTANT_LEGAL_POLICY.privacyNoticeVersion;
    }
  | {
      allowed: false;
      reason: "authentication_required" | "role_not_permitted" | "acceptance_required";
    };

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
// Share the existing app role vocabulary; never trust roles supplied by the UI.
const ASSISTANT_ROLES: ReadonlySet<string> = new Set<Role>(["cliente", "tecnico", "admin"]);
const MAX_CLOCK_SKEW_MS = 60_000;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Pure, fail-closed policy decision. No external I/O, no secrets or PII logs. */
export function decideAssistantAccess(
  principal: TrustedAssistantSession | null,
  acceptance: StoredAssistantLegalAcceptance | null,
  nowMs: number,
): AssistantAccessDecision {
  if (
    !Number.isFinite(nowMs) ||
    !principal ||
    !isUuid(principal.userId) ||
    !Number.isFinite(principal.expiresAtMs) ||
    principal.expiresAtMs <= nowMs
  ) return { allowed: false, reason: "authentication_required" };

  if (
    !Array.isArray(principal.roles) ||
    !principal.roles.some((role) => ASSISTANT_ROLES.has(role))
  ) return { allowed: false, reason: "role_not_permitted" };

  if (
    !acceptance ||
    !isUuid(acceptance.userId) ||
    acceptance.userId.toLowerCase() !== principal.userId.toLowerCase() ||
    acceptance.termsVersion !== ASSISTANT_LEGAL_POLICY.termsVersion ||
    acceptance.privacyNoticeVersion !== ASSISTANT_LEGAL_POLICY.privacyNoticeVersion ||
    typeof acceptance.acceptedAt !== "string" ||
    !ISO_TIMESTAMP.test(acceptance.acceptedAt)
  ) return { allowed: false, reason: "acceptance_required" };

  const acceptedAtMs = Date.parse(acceptance.acceptedAt);
  if (
    !Number.isFinite(acceptedAtMs) ||
    acceptedAtMs <= 0 ||
    acceptedAtMs > nowMs + MAX_CLOCK_SKEW_MS
  ) return { allowed: false, reason: "acceptance_required" };

  return {
    allowed: true,
    userId: principal.userId,
    termsVersion: ASSISTANT_LEGAL_POLICY.termsVersion,
    privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
  };
}
