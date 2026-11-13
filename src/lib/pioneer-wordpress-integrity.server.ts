import { createHash } from "node:crypto";
import {
  findWordPressOriginalAliasCandidates,
  type WordPressDirectorySnapshot,
  type WordPressReviewSnapshot,
} from "./pioneer-wordpress-archive-adapter.server";

/**
 * PRIVATE, offline verification stage between the imported WordPress snapshots
 * and the R2 name projector. Neither R1 nor the imported mirror preserves a
 * cryptographically immutable original title. A manifest MUST be independently
 * produced from a verified original backup and pinned outside this module.
 *
 * A digest computed from the current mirror is self-attestation, NOT proof.
 * Do not feed the result into the public DTO until the existing R2 projector
 * also verifies eligibility, canonical status, audit and public-name equality.
 */
export type WordPressOriginalAliasAttestation = {
  /** The private R1 source_key, not a public slug or technician UUID. */
  source_key: string;
  /** SHA-256 of JSON.stringify(["eut-wordpress-original-alias-v1", source_key, raw title]). */
  original_alias_sha256: string;
  /** SHA-256 of the independently preserved source backup. */
  backup_sha256: string;
};

export type R1WordPressProvenance = {
  technician_id: string;
  catalog_origin: string;
  source_key: string;
};

export type WordPressAliasIntegrityInput = {
  directory: readonly WordPressDirectorySnapshot[];
  review: readonly WordPressReviewSnapshot[];
  /** Separately verified and pinned original WordPress backup digest. */
  trustedBackupSha256: string;
  /** Independent private attestations, not regenerated from `directory`. */
  originalAttestations: readonly WordPressOriginalAliasAttestation[];
  /** Private R1 catalog_provenance rows; never read them from an anonymous route. */
  r1Provenance: readonly R1WordPressProvenance[];
};

/** Produces only the private archivedAliases input of projectAuditedWordPressAliasLinks. */
export type VerifiedWordPressAlias = { source_key: string; original_alias: string };

const SOURCE_ID = /^wordpress_20261108:[1-9][0-9]*$/;
const SHA256 = /^[a-f0-9]{64}$/;

function originalAliasDigest(sourceKey: string, rawAlias: string): string {
  return createHash("sha256")
    .update(JSON.stringify(["eut-wordpress-original-alias-v1", sourceKey, rawAlias]), "utf8")
    .digest("hex");
}

function exactlyOne<T>(rows: readonly T[], matches: (row: T) => boolean): T | null {
  const found = rows.filter(matches);
  return found.length === 1 ? found[0]! : null;
}

/** No fallback by name, telephone, DDD, nickname, slug or unverified origin. */
export function verifyWordPressAliasIntegrity(
  input: WordPressAliasIntegrityInput,
): VerifiedWordPressAlias[] {
  if (!SHA256.test(input.trustedBackupSha256)) return [];

  const verified: VerifiedWordPressAlias[] = [];
  for (const candidate of findWordPressOriginalAliasCandidates(input.directory, input.review)) {
    const { sourceId, candidateOriginalAlias } = candidate;
    if (!SOURCE_ID.test(sourceId)) continue;

    // Preserve byte-exact integrity. The earlier adapter trims for display; do
    // not pretend a normalized title is identical to the archived raw title.
    const original = exactlyOne(
      input.directory,
      (row) => `${row.source_key}:${row.wp_post_id}` === sourceId,
    );
    if (!original || original.title !== candidateOriginalAlias) continue;

    const attestation = exactlyOne(
      input.originalAttestations,
      (row) => row.source_key === sourceId,
    );
    if (
      !attestation ||
      !SHA256.test(attestation.original_alias_sha256) ||
      attestation.backup_sha256 !== input.trustedBackupSha256 ||
      attestation.original_alias_sha256 !== originalAliasDigest(sourceId, original.title)
    )
      continue;

    // R1 allows arbitrary import keys; it does NOT automatically link a WP ID.
    // Only an exact persisted source_key, with an unambiguous private 1:1 map,
    // can bridge the two independent contracts.
    const provenance = exactlyOne(input.r1Provenance, (row) => row.source_key === sourceId);
    if (
      !provenance ||
      provenance.catalog_origin !== "wordpress" ||
      !provenance.technician_id ||
      input.r1Provenance.filter((row) => row.technician_id === provenance.technician_id).length !==
        1
    )
      continue;

    verified.push({ source_key: sourceId, original_alias: original.title });
  }
  return verified;
}
