import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { projectAuditedWordPressAliasLinks } from "./pioneer-name-link.server";
import {
  verifyWordPressAliasIntegrity,
  type WordPressAliasIntegrityInput,
} from "./pioneer-wordpress-integrity.server";

const technicianId = "00000000-0000-4000-8000-000000000123";
const sourceId = "wordpress_20261108:123";
const alias = "almeidathiagosantos5";
const backupHash = "a".repeat(64);

// In production these manifest entries must come from an INDEPENDENTLY verified
// original backup, never from the imported mirror being checked here.
function archivedDigest(key: string, rawTitle: string): string {
  return createHash("sha256")
    .update(JSON.stringify(["eut-wordpress-original-alias-v1", key, rawTitle]), "utf8")
    .digest("hex");
}

function fixture(): WordPressAliasIntegrityInput {
  const directory = {
    source_key: "wordpress_20261108",
    wp_post_id: 123,
    kind: "candidate",
    title: alias,
  };
  return {
    directory: [directory],
    review: [{ ...directory, demo_candidate: false }],
    trustedBackupSha256: backupHash,
    originalAttestations: [
      {
        source_key: sourceId,
        original_alias_sha256: archivedDigest(sourceId, alias),
        backup_sha256: backupHash,
      },
    ],
    r1Provenance: [
      { technician_id: technicianId, catalog_origin: "wordpress", source_key: sourceId },
    ],
  };
}

describe("offline WordPress original-alias integrity and exact R1 key", () => {
  it("produces only a private verified alias, consumed by the R2-gated projector", () => {
    const input = fixture();
    const archivedAliases = verifyWordPressAliasIntegrity(input);
    expect(archivedAliases).toEqual([{ source_key: sourceId, original_alias: alias }]);

    const project = (r2EligibleIds: string[]) =>
      projectAuditedWordPressAliasLinks({
        r2EligibleIds,
        publicRows: [{ id: technicianId, display_name: alias }],
        canonicalRows: [
          {
            id: technicianId,
            display_name: alias,
            user_id: null,
            status: "pendente",
            catalog_enabled: true,
            catalog_origin: "wordpress",
          },
        ],
        privateProvenance: input.r1Provenance,
        catalogCreationAudit: [
          {
            actor_id: "00000000-0000-4000-8000-000000000999",
            target_type: "technician",
            target_key: technicianId,
            action: "catalog_created",
            after_state: { origin: "wordpress", catalog_enabled: true, auth_user_created: false },
          },
        ],
        archivedAliases,
      });
    expect(project([])).toEqual([]); // Blocked/disabled/unknown IDs are excluded by R2.
    const publicResult = project([technicianId]);
    expect(publicResult).toEqual([{ technicianId, provenanceLinkedWordPressAlias: alias }]);
    expect(JSON.stringify(publicResult)).not.toMatch(
      /source_key|catalog_origin|phone|DDD|actor_id|audit/,
    );
  });

  it("fails closed without an independently pinned backup and exact archive digest", () => {
    expect(verifyWordPressAliasIntegrity({ ...fixture(), trustedBackupSha256: "" })).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({ ...fixture(), trustedBackupSha256: "b".repeat(64) }),
    ).toEqual([]);
    expect(verifyWordPressAliasIntegrity({ ...fixture(), originalAttestations: [] })).toEqual([]);
    const base = fixture();
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        originalAttestations: [
          { ...base.originalAttestations[0]!, original_alias_sha256: "0".repeat(64) },
        ],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        originalAttestations: [
          { ...base.originalAttestations[0]!, original_alias_sha256: "invalid" },
        ],
      }),
    ).toEqual([]);
  });

  it("refuses a near-match R1 key, different origin and duplicate private provenance", () => {
    const base = fixture();
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        r1Provenance: [{ ...base.r1Provenance[0]!, source_key: "wordpress_20261108:0123" }],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        r1Provenance: [{ ...base.r1Provenance[0]!, catalog_origin: "external_import" }],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        r1Provenance: [...base.r1Provenance, ...base.r1Provenance],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        r1Provenance: [
          ...base.r1Provenance,
          {
            technician_id: technicianId,
            catalog_origin: "wordpress",
            source_key: "wordpress_20261108:999",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects changes to the originally archived alias, including whitespace", () => {
    const base = fixture();
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        directory: [{ ...base.directory[0]!, title: "Novo Nome" }],
        review: [{ ...base.review[0]!, title: "Novo Nome" }],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        directory: [{ ...base.directory[0]!, title: ` ${alias} ` }],
        review: [{ ...base.review[0]!, title: ` ${alias} ` }],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        review: [{ ...base.review[0]!, demo_candidate: true }],
      }),
    ).toEqual([]);
  });

  it("rejects duplicate archive attestations or imported source identities", () => {
    const base = fixture();
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        originalAttestations: [...base.originalAttestations, ...base.originalAttestations],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({ ...base, directory: [...base.directory, ...base.directory] }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({ ...base, review: [...base.review, ...base.review] }),
    ).toEqual([]);
  });

  it("never associates matching aliases with a different WordPress post or R1 source key", () => {
    const base = fixture();
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        directory: [{ ...base.directory[0]!, wp_post_id: 124 }],
        review: [{ ...base.review[0]!, wp_post_id: 124 }],
      }),
    ).toEqual([]);
    expect(
      verifyWordPressAliasIntegrity({
        ...base,
        originalAttestations: [
          { ...base.originalAttestations[0]!, source_key: "wordpress_20261108:124" },
        ],
      }),
    ).toEqual([]);
  });
});
