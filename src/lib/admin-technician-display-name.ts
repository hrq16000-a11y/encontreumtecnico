/**
 * Remove an exact SEO service+city suffix from a captured listing title.
 * This is presentation-only: source names and identifiers stay unchanged.
 * Never guess a person's/business's name when the suffix is the entire title.
 */
export function technicianDisplayName(rawName: string, confirmedCity?: string | null): string {
  const original = rawName.trim().replace(/\s+/g, " ");
  const city = confirmedCity?.trim().replace(/\s+/g, " ");
  if (!city) return original;

  const quotedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = new RegExp(`\\s+Técnico\\s+de\\s+Informática\\s+${quotedCity}$`, "iu");
  const nameOnly = original.replace(suffix, "").trim();
  return nameOnly.length >= 2 ? nameOnly : original;
}
