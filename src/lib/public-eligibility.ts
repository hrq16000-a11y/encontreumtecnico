/**
 * Server-side public visibility contract.
 *
 * Never consult private ban lists in JavaScript or expose ban reasons, owner
 * IDs or private phones to the frontend. The staged Supabase RPC returns ONLY
 * eligible technician IDs. Missing RPC / failed moderation checks fail CLOSED.
 *
 * NOTE: Activation requires the reviewed, unapplied RLS/RPC migration in
 * docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql.
 */
export type PublicEligibilityRow = { id: string };
export type PublicEligibilityRpc = {
  rpc: (name: string, params: { _ids: string[] }) =>
    Promise<{ data: unknown; error: unknown }>;
};

const ELIGIBILITY_BATCH = 500;

export function filterPublicEligibleRows<T extends PublicEligibilityRow>(
  rows: readonly T[],
  authorizedIds: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => authorizedIds.has(row.id));
}

/**
 * Check every candidate with a single, privileged DATABASE decision.
 * No "legacy fallback": approval alone must never override a ban.
 */
export async function readPublicEligibleRows<T extends PublicEligibilityRow>(
  rpcClient: PublicEligibilityRpc,
  rows: readonly T[],
): Promise<T[]> {
  if (!rows.length) return [];
  const authorized = new Set<string>();
  const originalIds = new Set(rows.map(row => row.id));
  const ids = [...originalIds];
  for (let offset = 0; offset < ids.length; offset += ELIGIBILITY_BATCH) {
    const slice = ids.slice(offset, offset + ELIGIBILITY_BATCH);
    let result: { data: unknown; error: unknown };
    try {
      result = await rpcClient.rpc("eut_public_eligible_technician_ids", { _ids: slice });
    } catch {
      throw new Error("Public technician eligibility unavailable");
    }
    if (result?.error || !Array.isArray(result?.data)) {
      throw new Error("Public technician eligibility unavailable");
    }
    for (const value of result.data) {
      if (!value || typeof value !== "object" ||
        typeof (value as { technician_id?: unknown }).technician_id !== "string") {
        throw new Error("Invalid public eligibility response");
      }
      const id = (value as { technician_id: string }).technician_id;
      // Ignore any extraneous ID; the RPC must not enrich other users' data.
      if (originalIds.has(id) && slice.includes(id)) authorized.add(id);
    }
  }
  return filterPublicEligibleRows(rows, authorized);
}
