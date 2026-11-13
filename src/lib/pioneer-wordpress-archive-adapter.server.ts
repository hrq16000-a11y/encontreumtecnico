/**
 * Local contract based on the versioned migration sources:
 * - eut_migration.legacy_directory (original WordPress import)
 * - public.legacy_review_profiles (admin-only imported mirror)
 * - docs/sql/eut-pioneers-native-pre-registry.sql, which builds
 *   source_id = directory.source_key || ':' || directory.wp_post_id.
 *
 * This adapter does NOT read hosted tables or prove immutability of the original
 * import. It only identifies exact-match PRIVATE candidates for later archival
 * verification. The output deliberately does not match the R2 projection's
 * `archivedAliases` input: an independent immutable-source attestation and the
 * R1 provenance key match are still required before promotion.
 */
export type WordPressDirectorySnapshot = {
  source_key: string;
  wp_post_id: number;
  kind: string;
  title: string;
};

export type WordPressReviewSnapshot = WordPressDirectorySnapshot & {
  demo_candidate: boolean;
};

export type WordPressAliasCandidate = {
  sourceId: string;
  candidateOriginalAlias: string;
};

const WORDPRESS_SNAPSHOT = "wordpress_20261108";

/** Never match on name, slug, Auth identity, DDD or telephone. */
export function findWordPressOriginalAliasCandidates(
  directory: readonly WordPressDirectorySnapshot[],
  review: readonly WordPressReviewSnapshot[],
): WordPressAliasCandidate[] {
  const candidates: WordPressAliasCandidate[] = [];
  const seen = new Set<string>();

  for (const row of directory) {
    if (row.source_key !== WORDPRESS_SNAPSHOT || row.kind !== "candidate" ||
        !Number.isSafeInteger(row.wp_post_id) || row.wp_post_id <= 0 || !row.title.trim()) continue;

    const sourceId = `${row.source_key}:${row.wp_post_id}`;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    // The source must be unique in each snapshot. A mismatch or a demo is not
    // evidence of the original alias, even if its public name looks plausible.
    const originals = directory.filter((item) =>
      item.source_key === row.source_key && item.wp_post_id === row.wp_post_id);
    const matches = review.filter((item) =>
      item.source_key === row.source_key && item.wp_post_id === row.wp_post_id);
    if (originals.length !== 1 || matches.length !== 1) continue;
    const mirror = matches[0]!;
    if (mirror.kind !== "candidate" || mirror.demo_candidate || mirror.title !== row.title) continue;

    candidates.push({ sourceId, candidateOriginalAlias: row.title.trim() });
  }

  return candidates;
}
