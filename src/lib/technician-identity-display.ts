/**
 * Presentation-only helpers. Never pass a raw private telephone to the browser.
 * A four-digit suffix may be supplied only by a consent-aware server projection.
 */
export function technicianInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  return words.slice(0, 2).map((word) =>
    Array.from(word)[0]?.toLocaleUpperCase("pt-BR") ?? "",
  ).join("") || "T";
}

export function maskedVerifiedPhoneTail(tail: string | null | undefined): string | null {
  if (!tail || !/^\d{4}$/.test(tail)) return null;
  return `•••• ${tail}`;
}

/**
 * Original legacy portraits must first be independently verified.
 * Reject arbitrary URL injection, third-party image search and guessed avatars.
 */
export function verifiedLegacyAvatarSource(source: string | null | undefined): string | null {
  if (!source) return null;
  return /^https:\/\/res\.cloudinary\.com\/dqnwlodjs\/image\/upload\/v\d+\/encontreumtecnico\/legacy\/wp-candidate-\d+\.webp$/.test(source)
    ? source
    : null;
}
