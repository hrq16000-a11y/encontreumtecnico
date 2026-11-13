import type { Role } from "../hooks/use-auth";
import type { TrustedAssistantSession } from "./assistant-access-contract";

/**
 * Offline bridge for a FUTURE server-only assistant handler (#261).
 *
 * The caller MUST first run requireSupabaseAuth (which verifies JWT claims)
 * and load role rows using that verified server-side user ID. Do not pass
 * request JSON, browser useAuth state, JWT user_metadata or a raw decoded token.
 * This mapper does NOT verify JWT signatures, session revocation, role grants,
 * operational bans or versioned legal acceptance. None of the active AI
 * handlers call it yet.
 */
export type VerifiedAssistantAuthContext = {
  userId: string;
  claims: { sub?: unknown; exp?: unknown };
};

export type ServerAuthorizedRoleRow = { role: unknown };

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const ROLES: ReadonlySet<string> = new Set<Role>(["cliente", "tecnico", "admin"]);

export function assistantPrincipalFromVerifiedContext(
  verified: VerifiedAssistantAuthContext | null,
  serverRoles: readonly ServerAuthorizedRoleRow[] | null,
  nowMs: number,
): TrustedAssistantSession | null {
  const userId = verified?.userId;
  const sub = verified?.claims?.sub;
  const exp = verified?.claims?.exp;
  if (
    !Number.isFinite(nowMs) ||
    typeof userId !== "string" || !UUID.test(userId) ||
    typeof sub !== "string" || !UUID.test(sub) ||
    userId.toLowerCase() !== sub.toLowerCase() ||
    typeof exp !== "number" || !Number.isSafeInteger(exp) ||
    exp <= 0 || exp * 1000 <= nowMs
  ) return null;

  // A failed/unavailable role lookup MUST be represented as null, never
  // as "any authenticated user". Reject unknown/malformed database rows.
  if (!Array.isArray(serverRoles) || serverRoles.length === 0) return null;
  const roles: Role[] = [];
  for (const row of serverRoles) {
    if (!row || typeof row.role !== "string" || !ROLES.has(row.role)) return null;
    const role = row.role as Role;
    if (!roles.includes(role)) roles.push(role);
  }

  return { userId, roles, expiresAtMs: exp * 1000 };
}
