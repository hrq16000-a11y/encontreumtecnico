import { describe, expect, it } from "vitest";
import { projectAuditedWordPressAliasLinks, type PioneerNameLinkInput } from "./pioneer-name-link.server";

const technicianId = "00000000-0000-4000-8000-000000000123";
const alias = "almeidathiagosantos5";

function evidence(): PioneerNameLinkInput {
  return {
    r2EligibleIds: [technicianId],
    publicRows: [{ id: technicianId, display_name: alias }],
    canonicalRows: [{
      id: technicianId, display_name: alias, user_id: null,
      status: "pendente", catalog_enabled: true, catalog_origin: "wordpress",
    }],
    privateProvenance: [{
      technician_id: technicianId, catalog_origin: "wordpress", source_key: "wp:synthetic:123",
    }],
    catalogCreationAudit: [{
      actor_id: "00000000-0000-4000-8000-000000000999",
      target_type: "technician", target_key: technicianId, action: "catalog_created",
      after_state: { origin: "wordpress", catalog_enabled: true, auth_user_created: false },
    }],
    archivedAliases: [{ source_key: "wp:synthetic:123", original_alias: alias }],
  };
}

describe("WordPress name link: private evidence after actual R2 membership", () => {
  it("projects only the original public alias, never private evidence", () => {
    const input = evidence();
    const output = projectAuditedWordPressAliasLinks(input);
    expect(output).toEqual([{
      technicianId, provenanceLinkedWordPressAlias: alias,
    }]);
    expect(JSON.stringify(output)).not.toMatch(/source_key|catalog_origin|actor_id|phone|audit|user_id/);
  });

  it("denies a blocked or disabled technician removed by the R2 result", () => {
    expect(projectAuditedWordPressAliasLinks({ ...evidence(), r2EligibleIds: [] })).toEqual([]);
    const disabled = evidence();
    disabled.canonicalRows = [{ ...disabled.canonicalRows[0]!, catalog_enabled: false }];
    expect(projectAuditedWordPressAliasLinks(disabled)).toEqual([]);
  });

  it("denies missing/mismatched provenance, source archive or creation audit", () => {
    const noProvenance = evidence();
    noProvenance.privateProvenance = [];
    expect(projectAuditedWordPressAliasLinks(noProvenance)).toEqual([]);
    const mismatch = evidence();
    mismatch.privateProvenance = [{ ...mismatch.privateProvenance[0]!, source_key: "other" }];
    expect(projectAuditedWordPressAliasLinks(mismatch)).toEqual([]);
    const noAudit = evidence();
    noAudit.catalogCreationAudit = [];
    expect(projectAuditedWordPressAliasLinks(noAudit)).toEqual([]);
    const wrongOrigin = evidence();
    wrongOrigin.canonicalRows = [{ ...wrongOrigin.canonicalRows[0]!, catalog_origin: "organic_auth" }];
    expect(projectAuditedWordPressAliasLinks(wrongOrigin)).toEqual([]);
  });

  it("rejects unaudited creation, Auth ownership and legacy moderation mismatches", () => {
    const anonymousAudit = evidence();
    anonymousAudit.catalogCreationAudit = [{ ...anonymousAudit.catalogCreationAudit[0]!, actor_id: null }];
    expect(projectAuditedWordPressAliasLinks(anonymousAudit)).toEqual([]);
    const claimedAuth = evidence();
    claimedAuth.catalogCreationAudit = [{ ...claimedAuth.catalogCreationAudit[0]!,
      after_state: { origin: "wordpress", catalog_enabled: true, auth_user_created: true } }];
    expect(projectAuditedWordPressAliasLinks(claimedAuth)).toEqual([]);
    const owned = evidence();
    owned.canonicalRows = [{ ...owned.canonicalRows[0]!, user_id: "00000000-0000-4000-8000-000000000777" }];
    expect(projectAuditedWordPressAliasLinks(owned)).toEqual([]);
    const rejected = evidence();
    rejected.canonicalRows = [{ ...rejected.canonicalRows[0]!, status: "rejeitado" }];
    expect(projectAuditedWordPressAliasLinks(rejected)).toEqual([]);
  });

  it("never overrides an edited name or accepts an ambiguous alias", () => {
    const edited = evidence();
    edited.publicRows = [{ id: technicianId, display_name: "Nome Declarado" }];
    edited.canonicalRows = [{ ...edited.canonicalRows[0]!, display_name: "Nome Declarado" }];
    expect(projectAuditedWordPressAliasLinks(edited)).toEqual([]);
    const uncertain = evidence();
    uncertain.archivedAliases = [{ source_key: "wp:synthetic:123", original_alias: "empresaunica998" }];
    uncertain.publicRows = [{ id: technicianId, display_name: "empresaunica998" }];
    uncertain.canonicalRows = [{ ...uncertain.canonicalRows[0]!, display_name: "empresaunica998" }];
    expect(projectAuditedWordPressAliasLinks(uncertain)).toEqual([]);
  });

  it("fails closed for duplicated private or archive provenance", () => {
    const duplicate = evidence();
    duplicate.privateProvenance = [...duplicate.privateProvenance, ...duplicate.privateProvenance];
    expect(projectAuditedWordPressAliasLinks(duplicate)).toEqual([]);
    const duplicateArchive = evidence();
    duplicateArchive.archivedAliases = [...duplicateArchive.archivedAliases, ...duplicateArchive.archivedAliases];
    expect(projectAuditedWordPressAliasLinks(duplicateArchive)).toEqual([]);
  });
});
