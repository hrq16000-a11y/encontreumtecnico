import { readPublicEligibleRows, type PublicEligibilityRpc } from "./public-eligibility";

/**
 * Server-only staging contract: none of these internal fields may be serialized.
 * originalWordPressAlias must come from an independently audited, immutable
 * source record. R1 currently DOES NOT expose such a persisted field, so a
 * production caller must pass null until that contract is actually available.
 */
export type R2AliasCandidate = {
  id: string;
  display_name: string | null;
  user_id: string | null;
  status: string;
  catalog_enabled: boolean | null;
  catalog_origin: string | null;
  originalWordPressAlias: string | null;
};

/** Strict allowlist: only values already suitable for a public card. */
export type PublicAliasHint = {
  id: string;
  provenanceLinkedWordPressAlias: string | null;
};

/**
 * R2 is the first and mandatory authorization step. Neither source metadata
 * nor an alias may turn an ineligible technician into a visible listing.
 * An edited label never authorizes reconstructing the historical nickname.
 */
export async function collectR2EligibleWordPressAliasHints<T extends R2AliasCandidate>(
  rpcClient: PublicEligibilityRpc,
  candidates: readonly T[],
): Promise<PublicAliasHint[]> {
  const eligible = await readPublicEligibleRows(rpcClient, candidates);
  return eligible.map((record) => {
    const original = record.originalWordPressAlias?.trim() ?? "";
    const current = record.display_name?.trim() ?? "";
    const canUseOriginal = record.user_id === null &&
      record.status === "pendente" && record.catalog_enabled === true &&
      record.catalog_origin === "wordpress" &&
      original.length > 0 && current === original;

    // Do not spread `record`: it could contain phone, source_key or audit data.
    return {
      id: record.id,
      provenanceLinkedWordPressAlias: canUseOriginal ? original : null,
    };
  });
}
