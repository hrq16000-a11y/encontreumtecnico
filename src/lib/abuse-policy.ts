/** Phase 4: action-scoped, server-verifiable failures ONLY.
 * Never derive penalties from IP, VPN, provider, UA, neighbourhood or anonymous cookies.
 * Auth and password recovery need their own provider/edge controls; this guard protects
 * only a confirmed account's sensitive application actions.
 */
export const ABUSE_ACTIONS = [
  "contact_access", "direct_request", "role_activation", "member_invite",
] as const;
export type AbuseAction = (typeof ABUSE_ACTIONS)[number];
export type AbuseDecision =
  | { kind: "unverified"; allowed: false; retryAfterSeconds: 0 }
  | { kind: "allow" | "warn"; allowed: true; retryAfterSeconds: 0 }
  | { kind: "cooldown"; allowed: false; retryAfterSeconds: number };

export type VerifiedFailureState = {
  accountVerified: boolean;
  failures15m: number;
  failures7d: number;
  priorHolds7d: number;
  blockedUntil: string | null;
};

export const ABUSE_POLICY = {
  warnAt: 5,
  twoHoursAt: 10,
  fiveHoursAt: 13,
  burstWindowMinutes: 15,
  escalationWindowDays: 7,
  cooldownHours: [2, 5, 24] as const,
} as const;

/** Pure policy for QA. The database must serialize real writes per actor/action. */
export function decideVerifiedAction(state: VerifiedFailureState, now = new Date()): AbuseDecision {
  if (!state.accountVerified) return { kind: "unverified", allowed: false, retryAfterSeconds: 0 };
  const lockedUntil = state.blockedUntil === null ? NaN : Date.parse(state.blockedUntil);
  const remaining = Number.isFinite(lockedUntil) ? Math.max(0, Math.ceil((lockedUntil - now.getTime()) / 1000)) : 0;
  if (remaining > 0) return { kind: "cooldown", allowed: false, retryAfterSeconds: remaining };
  const burst = Math.max(0, Math.trunc(state.failures15m));
  const week = Math.max(0, Math.trunc(state.failures7d));
  if (burst >= ABUSE_POLICY.warnAt && week >= ABUSE_POLICY.fiveHoursAt) {
    const hours = state.priorHolds7d >= 2 ? 24 : 5;
    return { kind: "cooldown", allowed: false, retryAfterSeconds: hours * 3600 };
  }
  if (burst >= ABUSE_POLICY.warnAt && week >= ABUSE_POLICY.twoHoursAt)
    return { kind: "cooldown", allowed: false, retryAfterSeconds: 2 * 3600 };
  if (burst >= ABUSE_POLICY.warnAt) return { kind: "warn", allowed: true, retryAfterSeconds: 0 };
  return { kind: "allow", allowed: true, retryAfterSeconds: 0 };
}

export type AbuseRow = {
  actor_id: string;
  action_kind: AbuseAction;
  failures_15m: number;
  failures_7d: number;
  blocked_until: string | null;
  updated_at: string;
};
export type AbuseAudit = { action_kind: AbuseAction; action: "release"; created_at: string; reason: string; actor_suffix: string };
export type AbuseSnapshot = { rows: AbuseRow[]; audit: AbuseAudit[]; total: number; page: number };
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export function parseAbuseSnapshot(data: unknown): AbuseSnapshot | null {
  if (!isRecord(data) || data["ok"] !== true || !Array.isArray(data["rows"]) || !Array.isArray(data["audit"])) return null;
  const result = data["rows"].map((raw): AbuseRow | null => {
    if (!isRecord(raw) || typeof raw["actor_id"] !== "string" || !uuidPattern.test(raw["actor_id"]) ||
      !ABUSE_ACTIONS.includes(raw["action_kind"] as AbuseAction) ||
      !Number.isSafeInteger(raw["failures_15m"]) || !Number.isSafeInteger(raw["failures_7d"]) ||
      typeof raw["updated_at"] !== "string" || !Number.isFinite(Date.parse(raw["updated_at"])) ||
      (raw["blocked_until"] !== null && (typeof raw["blocked_until"] !== "string" || !Number.isFinite(Date.parse(raw["blocked_until"])))))
      return null;
    return {
      actor_id: raw["actor_id"], action_kind: raw["action_kind"] as AbuseAction,
      failures_15m: raw["failures_15m"] as number, failures_7d: raw["failures_7d"] as number,
      blocked_until: raw["blocked_until"] as string | null, updated_at: raw["updated_at"],
    };
  });
  const audit = data["audit"].map((raw): AbuseAudit | null =>
    isRecord(raw) && ABUSE_ACTIONS.includes(raw["action_kind"] as AbuseAction) &&
    raw["action"] === "release" && typeof raw["created_at"] === "string" &&
    typeof raw["reason"] === "string" && typeof raw["actor_suffix"] === "string"
      ? { action_kind: raw["action_kind"] as AbuseAction, action: "release",
        created_at: raw["created_at"], reason: raw["reason"], actor_suffix: raw["actor_suffix"] }
      : null);
  if (result.includes(null) || audit.includes(null) || !Number.isSafeInteger(data["total"]) || !Number.isSafeInteger(data["page"])) return null;
  return { rows: result as AbuseRow[], audit: audit as AbuseAudit[], total: data["total"] as number, page: data["page"] as number };
}

/** Policy gate: no row of "evidence" in the browser can activate the backend.
 * This reports missing operator confirmations and never flips a feature flag.
 */
export const PHASE3_REQUIRED_EVIDENCE = [
  "legalReviewApproved", "privateTablesAndRlsTested", "atomicLimiterInstalled",
  "officialActionsGuarded", "providerAndEdgeControlsVerified", "trustedIpSourceProven",
  "retentionJobObserved", "anonymousNegativeTestsPassed", "rollbackPrepared",
] as const;
export type Phase3Evidence = Record<(typeof PHASE3_REQUIRED_EVIDENCE)[number], boolean>;
export function missingPhase3Evidence(evidence: Partial<Phase3Evidence> | null): string[] {
  return PHASE3_REQUIRED_EVIDENCE.filter(key => evidence?.[key] !== true);
}
