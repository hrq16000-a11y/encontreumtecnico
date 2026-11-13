import {
  verifyWordPressAliasIntegrity,
  type R1WordPressProvenance,
  type VerifiedWordPressAlias,
} from "./pioneer-wordpress-integrity.server";
import type {
  WordPressDirectorySnapshot,
  WordPressReviewSnapshot,
} from "./pioneer-wordpress-archive-adapter.server";

/**
 * Offline-only bridge for existing cutover tools:
 * - verify_backup_integrity.py: hashes the original SQL backup without reading
 *   its rows or executing SQL;
 * - reconcile_private_legacy_inventory.py: inventories WordPress post IDs but
 *   does NOT certify identity, aliases, contact details or provenance.
 *
 * The manifest must come from a separately audited extraction of that exact
 * pinned original backup. A checksum alone does not prove extraction fidelity.
 * No public route should import this module or serialize any of its inputs.
 */
export type OfflineWordPressAliasManifestInput = {
  /** Independently pinned SHA-256 of the original WordPress SQL archive. */
  pinnedOriginalSqlSha256: string;
  /** Unmodified JSON output of verify_backup_integrity.py. */
  backupIntegrityReport: unknown;
  /** Private alias attestation manifest, checked at runtime before use. */
  aliasManifest: unknown;
  /** Private output from reconcile_private_legacy_inventory.py. */
  inventoryReport: unknown;
  directory: readonly WordPressDirectorySnapshot[];
  review: readonly WordPressReviewSnapshot[];
  /** Private, audited R1 eut_moderation.catalog_provenance snapshot. */
  r1Provenance: readonly R1WordPressProvenance[];
};

const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^wordpress_20261108:([1-9][0-9]*)$/;
const MAX_ENTRIES = 100_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * Returns only private verified aliases for the EXISTING R2-gated projector.
 * Any missing, ambiguous or untrusted source yields no candidates. It never
 * treats matching names, telephone numbers, DDDs or WP origin flags as proof.
 */
export function validateOfflineWordPressAliasManifest(
  input: OfflineWordPressAliasManifestInput,
): VerifiedWordPressAlias[] {
  const pin = input.pinnedOriginalSqlSha256;
  if (!SHA256.test(pin)) return [];

  const backup = record(input.backupIntegrityReport);
  const oldSql = record(backup?.old_sql_dump);
  if (
    !backup ||
    backup.backup_integrity !== "pass" ||
    backup.cutover_approved !== false ||
    !oldSql ||
    oldSql.sha256 !== pin ||
    oldSql.sql_executed !== false ||
    !Number.isSafeInteger(oldSql.bytes) ||
    (oldSql.bytes as number) <= 0
  )
    return [];

  const manifest = record(input.aliasManifest);
  if (
    !manifest ||
    !onlyKeys(manifest, ["type", "backup_sha256", "entries"]) ||
    manifest.type !== "PRIVATE_EUT_WP_ORIGINAL_ALIAS_V1" ||
    manifest.backup_sha256 !== pin ||
    !Array.isArray(manifest.entries) ||
    manifest.entries.length > MAX_ENTRIES
  )
    return [];

  const attestations = [];
  for (const raw of manifest.entries) {
    const entry = record(raw);
    if (
      !entry ||
      !onlyKeys(entry, ["source_key", "original_alias_sha256", "backup_sha256"]) ||
      typeof entry.source_key !== "string" ||
      !SOURCE_ID.test(entry.source_key) ||
      typeof entry.original_alias_sha256 !== "string" ||
      !SHA256.test(entry.original_alias_sha256) ||
      entry.backup_sha256 !== pin
    )
      return [];
    attestations.push({
      source_key: entry.source_key,
      original_alias_sha256: entry.original_alias_sha256,
      backup_sha256: pin,
    });
  }

  const inventory = record(input.inventoryReport);
  if (
    !inventory ||
    inventory.type !== "PRIVATE_EUT_REVIEW_ONLY" ||
    inventory.approved_for_import !== false ||
    inventory.approved_for_publication !== false ||
    inventory.source_provenance_verified !== false ||
    !Array.isArray(inventory.entries) ||
    inventory.entries.length > MAX_ENTRIES
  )
    return [];

  const inventoriedPosts = new Set<number>();
  for (const raw of inventory.entries) {
    const entry = record(raw);
    const postId = entry?.wp_post_id;
    if (
      !Number.isSafeInteger(postId) ||
      (postId as number) <= 0 ||
      inventoriedPosts.has(postId as number)
    )
      return [];
    inventoriedPosts.add(postId as number);
  }

  const aliases = verifyWordPressAliasIntegrity({
    directory: input.directory,
    review: input.review,
    r1Provenance: input.r1Provenance,
    trustedBackupSha256: pin,
    originalAttestations: attestations,
  });
  return aliases.filter((alias) => {
    const matched = SOURCE_ID.exec(alias.source_key);
    const wpPostId = matched ? Number(matched[1]) : NaN;
    return Number.isSafeInteger(wpPostId) && inventoriedPosts.has(wpPostId);
  });
}
