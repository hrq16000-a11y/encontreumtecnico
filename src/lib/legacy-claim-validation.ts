/** Identificador do registro WordPress recebido pela interface; não prova titularidade. */
export function normalizeWpPostId(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d{0,11}$/.test(trimmed)) return null;
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function normalizeClaimantNote(note: string): string {
  return note.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

export function normalizeVerificationNote(note: string): string | null {
  const value = note.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return value.length >= 20 && value.length <= 600 ? value : null;
}

/** Caminho interno após login para retomar um pedido de recuperação. */
export function legacyClaimReturnPath(reference: string): string {
  const wpId = normalizeWpPostId(reference);
  return wpId ? `/reivindicar-cadastro?wp=${wpId}` : "/reivindicar-cadastro";
}

/** Aceita apenas URLs locais de recuperação, nunca um redirect arbitrário. */
export function safeLegacyClaimReturnPath(raw: string | null): string | null {
  if (raw === "/reivindicar-cadastro") return raw;
  if (!raw?.startsWith("/reivindicar-cadastro?wp=")) return null;
  const candidate = raw.slice("/reivindicar-cadastro?wp=".length);
  const wpId = normalizeWpPostId(candidate);
  return wpId && String(wpId) === candidate ? legacyClaimReturnPath(candidate) : null;
}
