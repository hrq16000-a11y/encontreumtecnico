import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { projectAuditedWordPressAliasLinks } from "./pioneer-name-link.server";
import {
  validateOfflineWordPressAliasManifest,
  type OfflineWordPressAliasManifestInput,
} from "./pioneer-wordpress-offline-manifest.server";

const technicianId = "00000000-0000-4000-8000-000000000123";
const sourceKey = "wordpress_20261108:123";
const originalAlias = "almeidathiagosantos5";
const sqlHash = "a".repeat(64);

function syntheticFixture(): OfflineWordPressAliasManifestInput {
  const original = {
    source_key: "wordpress_20261108",
    wp_post_id: 123,
    kind: "candidate",
    title: originalAlias,
  };
  return {
    pinnedOriginalSqlSha256: sqlHash,
    backupIntegrityReport: {
      backup_integrity: "pass",
      cutover_approved: false,
      old_sql_dump: { sha256: sqlHash, bytes: 4096, sql_executed: false },
    },
    aliasManifest: {
      type: "PRIVATE_EUT_WP_ORIGINAL_ALIAS_V1",
      backup_sha256: sqlHash,
      entries: [
        {
          source_key: sourceKey,
          backup_sha256: sqlHash,
          original_alias_sha256: createHash("sha256")
            .update(
              JSON.stringify(["eut-wordpress-original-alias-v1", sourceKey, originalAlias]),
              "utf8",
            )
            .digest("hex"),
        },
      ],
    },
    inventoryReport: {
      type: "PRIVATE_EUT_REVIEW_ONLY",
      source_provenance_verified: false,
      approved_for_import: false,
      approved_for_publication: false,
      entries: [{ wp_post_id: 123, phone_format_status: "plausible_format" }],
    },
    directory: [original],
    review: [{ ...original, demo_candidate: false }],
    r1Provenance: [
      { technician_id: technicianId, catalog_origin: "wordpress", source_key: sourceKey },
    ],
  };
}

describe("offline manifest handoff to WordPress alias integrity and R1/R2", () => {
  it("links only an exact private WordPress ID; public result remains R2-gated", () => {
    const input = syntheticFixture();
    const archivedAliases = validateOfflineWordPressAliasManifest(input);
    expect(archivedAliases).toEqual([{ source_key: sourceKey, original_alias: originalAlias }]);
    const projected = (eligibleIds: string[]) =>
      projectAuditedWordPressAliasLinks({
        r2EligibleIds: eligibleIds,
        publicRows: [{ id: technicianId, display_name: originalAlias }],
        canonicalRows: [
          {
            id: technicianId,
            display_name: originalAlias,
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
    expect(projected([])).toEqual([]);
    expect(projected([technicianId])).toEqual([
      { technicianId, provenanceLinkedWordPressAlias: originalAlias },
    ]);
    expect(JSON.stringify(projected([technicianId]))).not.toMatch(
      /source_key|phone|DDD|audit|backup/,
    );
  });

  it("rejects missing original checksum, fake checksum report or executed SQL", () => {
    const base = syntheticFixture();
    expect(validateOfflineWordPressAliasManifest({ ...base, pinnedOriginalSqlSha256: "" })).toEqual(
      [],
    );
    expect(
      validateOfflineWordPressAliasManifest({ ...base, pinnedOriginalSqlSha256: "b".repeat(64) }),
    ).toEqual([]);
    expect(validateOfflineWordPressAliasManifest({ ...base, backupIntegrityReport: null })).toEqual(
      [],
    );
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        backupIntegrityReport: {
          backup_integrity: "fail",
          cutover_approved: false,
          old_sql_dump: { sha256: sqlHash, bytes: 4096, sql_executed: false },
        },
      }),
    ).toEqual([]);
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        backupIntegrityReport: {
          backup_integrity: "pass",
          cutover_approved: false,
          old_sql_dump: { sha256: sqlHash, bytes: 4096, sql_executed: true },
        },
      }),
    ).toEqual([]);
  });

  it("rejects untrusted, extra-field or duplicate private manifest entries", () => {
    const base = syntheticFixture();
    expect(validateOfflineWordPressAliasManifest({ ...base, aliasManifest: null })).toEqual([]);
    const manifest = base.aliasManifest as {
      type: string;
      backup_sha256: string;
      entries: object[];
    };
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        aliasManifest: { ...manifest, backup_sha256: "b".repeat(64) },
      }),
    ).toEqual([]);
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        aliasManifest: { ...manifest, entries: [{ ...manifest.entries[0], phone: "synthetic" }] },
      }),
    ).toEqual([]);
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        aliasManifest: { ...manifest, entries: [...manifest.entries, ...manifest.entries] },
      }),
    ).toEqual([]);
  });

  it("reuses reconciler WordPress post IDs, never names or telephone hints", () => {
    const base = syntheticFixture();
    const inventory = base.inventoryReport as {
      type: string;
      entries: object[];
      source_provenance_verified: boolean;
      approved_for_import: boolean;
      approved_for_publication: boolean;
    };
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        inventoryReport: {
          ...inventory,
          entries: [{ wp_post_id: 124, phone_format_status: "plausible_format" }],
        },
      }),
    ).toEqual([]);
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        inventoryReport: { ...inventory, entries: [...inventory.entries, ...inventory.entries] },
      }),
    ).toEqual([]);
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        inventoryReport: { ...inventory, source_provenance_verified: true },
      }),
    ).toEqual([]);
    // A separate contact/DDD annotation is neither required nor consulted.
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        inventoryReport: {
          ...inventory,
          entries: [{ wp_post_id: 123, phone_format_status: "absent", ddd: "41" }],
        },
      }),
    ).toEqual([{ source_key: sourceKey, original_alias: originalAlias }]);
  });

  it("requires exact R1 catalog_provenance.source_key, not a plausible near-match", () => {
    const base = syntheticFixture();
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        r1Provenance: [{ ...base.r1Provenance[0]!, source_key: "wordpress_20261108:0123" }],
      }),
    ).toEqual([]);
    expect(
      validateOfflineWordPressAliasManifest({
        ...base,
        r1Provenance: [{ ...base.r1Provenance[0]!, catalog_origin: "external_import" }],
      }),
    ).toEqual([]);
    expect(validateOfflineWordPressAliasManifest({ ...base, r1Provenance: [] })).toEqual([]);
  });
});
