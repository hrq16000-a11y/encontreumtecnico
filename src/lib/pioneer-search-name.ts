import { suggestLegacyDisplayName } from "./legacy-display-name";

export type PioneerSearchName = {
  display: string;
  originalAlias: string | null;
  suggested: boolean;
};

/**
 * Presentation only. The caller must supply an alias linked by audited
 * WordPress provenance AFTER the server has approved public eligibility.
 * Do not infer provenance from a badge or from the spelling of a name.
 */
export function pioneerSearchName(
  displayName: string,
  provenanceLinkedWordPressAlias?: string | null,
): PioneerSearchName {
  const unchanged = { display: displayName, originalAlias: null, suggested: false };
  const alias = provenanceLinkedWordPressAlias?.trim();
  // Never override a name edited or declared by the technician.
  if (!alias || displayName.trim() !== alias) return unchanged;

  const hint = suggestLegacyDisplayName(alias);
  if (!hint.suggested) return unchanged;
  return { display: hint.display, originalAlias: hint.original, suggested: true };
}
