import { isValidTechnicianId } from "./technician-id";
import { pioneerSearchName } from "./pioneer-search-name";

/**
 * Fail-closed projection for a future PRIVATE, server-side catalog adapter.
 * This is not a database reader: R1/R2 currently have no immutable WordPress
 * alias field. The caller must obtain archived aliases independently from an
 * audited source before providing them here; do not derive them from slugs,
 * badges, public names or telephone numbers.
 *
 * Never serialize the private input records to a route, client or log. Only
 * the returned already-public alias is suitable for the presentation prop.
 */
export type PioneerNameLinkInput = {
  /** The actual UUID list returned by eut_public_eligible_technician_ids. */
  r2EligibleIds: readonly string[];
  publicRows: readonly { id: string; display_name: string | null }[];
  canonicalRows: readonly {
    id: string;
    display_name: string | null;
    user_id: string | null;
    status: string;
    catalog_enabled: boolean | null;
    catalog_origin: string;
  }[];
  privateProvenance: readonly {
    technician_id: string;
    catalog_origin: string;
    source_key: string;
  }[];
  catalogCreationAudit: readonly {
    actor_id: string | null;
    target_type: string;
    target_key: string;
    action: string;
    after_state: {
      origin?: string;
      catalog_enabled?: boolean;
      auth_user_created?: boolean;
    } | null;
  }[];
  /** Independent immutable WordPress archive, keyed by the R1 source_key. */
  archivedAliases: readonly { source_key: string; original_alias: string }[];
};

export type PublicPioneerNameLink = {
  technicianId: string;
  provenanceLinkedWordPressAlias: string;
};

function unique<T>(items: readonly T[], matches: (value: T) => boolean): T | null {
  const found = items.filter(matches);
  return found.length === 1 ? found[0]! : null;
}

export function projectAuditedWordPressAliasLinks(input: PioneerNameLinkInput): PublicPioneerNameLink[] {
  const r2Ids = new Set(input.r2EligibleIds.filter(isValidTechnicianId));
  const links: PublicPioneerNameLink[] = [];
  const processed = new Set<string>();

  for (const publicRow of input.publicRows) {
    const id = publicRow.id;
    if (!r2Ids.has(id) || processed.has(id)) continue;
    processed.add(id);

    const canonical = unique(input.canonicalRows, (row) => row.id === id);
    if (!canonical || canonical.user_id !== null || canonical.status !== "pendente" ||
        canonical.catalog_enabled !== true || canonical.catalog_origin !== "wordpress" ||
        !publicRow.display_name || publicRow.display_name !== canonical.display_name) continue;

    const provenance = unique(input.privateProvenance, (row) => row.technician_id === id);
    if (!provenance || provenance.catalog_origin !== "wordpress" || !provenance.source_key.trim()) continue;

    const audit = unique(input.catalogCreationAudit, (row) =>
      row.target_type === "technician" && row.target_key === id && row.action === "catalog_created");
    if (!audit || !audit.actor_id || audit.after_state?.origin !== "wordpress" ||
        audit.after_state.catalog_enabled !== true || audit.after_state.auth_user_created !== false) continue;

    const archive = unique(input.archivedAliases, (row) => row.source_key === provenance.source_key);
    if (!archive || !archive.original_alias.trim()) continue;
    const name = pioneerSearchName(publicRow.display_name, archive.original_alias);
    if (!name.suggested) continue; // Edited names and uncertain aliases remain untouched.

    links.push({ technicianId: id, provenanceLinkedWordPressAlias: name.originalAlias! });
  }

  return links;
}
