import { describe, expect, it } from "vitest";
import { ASSISTANT_LEGAL_POLICY, type TrustedAssistantSession } from "./assistant-access-contract";
import {
  decideAssistantAccessAfterLegalRead,
  type AssistantLegalEvidenceRead,
  type AssistantLegalEvidenceRow,
} from "./assistant-legal-evidence-gate";

/**
 * Offline, append-only EVENT FIXTURE for future LOCAL authorization tests (#261).
 * It does not create or prove any table, RLS policy, server reader or revocation RPC.
 * A real reader must independently authorize the verified subject and order events.
 */
const NOW = Date.parse("2026-11-13T04:00:00.000Z");
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const T1 = "2026-11-13T03:00:00.000Z";
const T2 = "2026-11-13T03:10:00.000Z";
const T3 = "2026-11-13T03:20:00.000Z";

type LegalEvent = {
  id: string;
  userId: string;
  at: string;
} & ({ kind: "accept"; termsVersion: string; privacyNoticeVersion: string } | { kind: "revoke" });

function syntheticLedger() {
  const events: LegalEvent[] = [];
  return {
    append(event: LegalEvent) {
      // Replaying an already recorded operation cannot undo its later revocation.
      const prior = events.find((item) => item.id === event.id);
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(event)) {
          throw new Error("conflicting synthetic idempotency key");
        }
        return;
      }
      events.push(Object.freeze({ ...event }));
    },
    history: () => events.map((event) => ({ ...event })),
    readAuthorized: async (verifiedUserId: string): Promise<AssistantLegalEvidenceRead> => {
      const own = events.filter((event) => event.userId === verifiedUserId);
      let row: AssistantLegalEvidenceRow | null = null;
      let previousTime = -Infinity;
      for (const event of own) {
        const timestamp = Date.parse(event.at);
        // Missing, ambiguous or reordered evidence must not silently authorize.
        if (!Number.isFinite(timestamp) || timestamp <= previousTime) {
          return { state: "unavailable" };
        }
        previousTime = timestamp;
        if (event.kind === "accept") {
          row = {
            userId: verifiedUserId,
            termsVersion: event.termsVersion,
            privacyNoticeVersion: event.privacyNoticeVersion,
            acceptedAt: event.at,
            revokedAt: null,
          };
        } else if (row) {
          row = { ...row, revokedAt: event.at };
        }
      }
      return row ? { state: "found", row } : { state: "missing" };
    },
  };
}

const session = (userId: string): TrustedAssistantSession => ({
  userId,
  roles: ["cliente"],
  expiresAtMs: NOW + 60_000,
});
const accept = (
  id: string,
  userId: string,
  at: string,
  termsVersion = ASSISTANT_LEGAL_POLICY.termsVersion,
): LegalEvent => ({
  id,
  userId,
  at,
  kind: "accept",
  termsVersion,
  privacyNoticeVersion: ASSISTANT_LEGAL_POLICY.privacyNoticeVersion,
});
const revoke = (id: string, userId: string, at: string): LegalEvent => ({
  id,
  userId,
  at,
  kind: "revoke",
});
const decision = (ledger: ReturnType<typeof syntheticLedger>, userId = USER) =>
  decideAssistantAccessAfterLegalRead(session(userId), ledger.readAuthorized, NOW);
const denied = { allowed: false, reason: "acceptance_required" };

describe("assistant versioned legal lifecycle — synthetic local rehearsal #261", () => {
  it("allows acceptance, closes immediately on revocation, and requires a NEW acceptance", async () => {
    const ledger = syntheticLedger();
    expect(await decision(ledger)).toEqual(denied);
    ledger.append(accept("accept-1", USER, T1));
    expect(await decision(ledger)).toMatchObject({ allowed: true, userId: USER });
    ledger.append(revoke("revoke-1", USER, T2));
    expect(await decision(ledger)).toEqual(denied);
    ledger.append(accept("accept-2", USER, T3));
    expect(await decision(ledger)).toMatchObject({ allowed: true, userId: USER });
    expect(ledger.history().map((event) => event.kind)).toEqual(["accept", "revoke", "accept"]);
  });

  it("never borrows another user's evidence or revocation", async () => {
    const ledger = syntheticLedger();
    ledger.append(accept("other-accept", OTHER, T1));
    expect(await decision(ledger)).toEqual(denied);
    expect(await decision(ledger, OTHER)).toMatchObject({ allowed: true, userId: OTHER });
    ledger.append(accept("user-accept", USER, T1));
    ledger.append(revoke("other-revoke", OTHER, T2));
    expect(await decision(ledger)).toMatchObject({ allowed: true, userId: USER });
    expect(await decision(ledger, OTHER)).toEqual(denied);
  });

  it("replaying an old acceptance ID cannot resurrect a revoked grant", async () => {
    const ledger = syntheticLedger();
    const recorded = accept("accept-1", USER, T1);
    ledger.append(recorded);
    ledger.append(revoke("revoke-1", USER, T2));
    ledger.append(recorded);
    expect(ledger.history()).toHaveLength(2);
    expect(await decision(ledger)).toEqual(denied);
    expect(() => ledger.append(accept("accept-1", USER, T3))).toThrow(/idempotency/);
  });

  it("denies stale document versions and ambiguous event ordering", async () => {
    const stale = syntheticLedger();
    stale.append(accept("stale-accept", USER, T1, "outdated-terms"));
    expect(await decision(stale)).toEqual(denied);

    const ambiguous = syntheticLedger();
    ambiguous.append(accept("accept-1", USER, T1));
    ambiguous.append(revoke("revoke-1", USER, T1));
    expect(await ambiguous.readAuthorized(USER)).toEqual({ state: "unavailable" });
    expect(await decision(ambiguous)).toEqual(denied);
  });
});
