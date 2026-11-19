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
  if (nameOnly !== original && nameOnly.length >= 2) return nameOnly;
  // Captures sometimes append the verified city directly to a business name.
  // Only strip multiword city suffixes from multiword prefixes, leaving ambiguous
  // names such as "Informática Curitiba" untouched. This never mutates source data.
  if (city.split(/\s+/).length < 2) return original;
  const plainCitySuffix = new RegExp(`\\s+${quotedCity}$`, "iu");
  const withoutCity = original.replace(plainCitySuffix, "").trim();
  if (/^Técnico de Informática$/iu.test(withoutCity)) return original;
  return withoutCity.split(/\s+/).length >= 2 ? withoutCity : original;
}
