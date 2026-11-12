/** One conservative public-text policy for registration, admin editing and SSR.
 * Bio is presentation-only: no digits in any Unicode form, links or contact details.
 * Other free-text fields may contain short model/brand numbers but never phone-like strings.
 */
export type PublicTextKind = "bio" | "identity";
const NUMBER_WORDS = new Set([
  "zero", "um", "uma", "dois", "duas", "tres", "três", "quatro", "cinco",
  "seis", "sete", "oito", "nove", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine",
]);
const CONTACT_WORDS = /(?:whats[\s\-]*app|wpp|zap|telegram|instagram|tiktok|facebook|telefone|celular|ligue|arroba|ponto\s*(?:com|br|net)|me\s*cham[ae]|chama\s*(?:no|na)\s*(?:zap|whats))/iu;
const LINK = /(?:https?\s*:\s*\/|www\s*\.|(?:w[\s.\-]*){3}\.|wa\s*\.\s*me|t\s*\.\s*me|api\s*\.\s*whatsapp|[\p{L}\p{N}_-]+\s*@\s*[\p{L}\p{N}_-]+|[\p{L}\p{N}_-]+\s*\.\s*(?:com|br|net|org|info|app|site|io|me|link|tech)\b)/iu;

export function publicTextProblem(raw: string | null | undefined, kind: PublicTextKind): string | null {
  if (!raw?.trim()) return null;
  const value = raw.normalize("NFKC").replace(/\p{Cf}/gu, "").toLocaleLowerCase("pt-BR");
  if (kind === "bio" && /\p{N}/u.test(value)) {
    return "A apresentação aceita apenas texto: remova todos os números, inclusive os separados por espaços ou linhas.";
  }
  if (CONTACT_WORDS.test(value) || LINK.test(value) || value.includes("@")) {
    return "Não inclua telefone, WhatsApp, redes sociais, e-mail ou links em campos públicos.";
  }
  const compact = value.replace(/[\p{Z}\p{P}\p{S}\p{Cf}\s]/gu, "");
  if (/(?:whatsapp|instagram|telegram|www|https?|wame|pontocom|arroba)/u.test(compact)) {
    return "Não inclua links ou canais de contato, mesmo com letras separadas.";
  }
  if (kind === "identity" && [...value.matchAll(/\p{N}/gu)].length >= 8) {
    return "Números de contato não são permitidos em nomes ou regiões públicas.";
  }
  let run = 0;
  for (const token of value.split(/[^\p{L}]+/u)) {
    run = NUMBER_WORDS.has(token) ? run + 1 : 0;
    if (run >= 5) return "Números escritos por extenso não são permitidos para divulgar contatos.";
  }
  return null;
}

/** Defensive output guard for already-published, migrated or stale records.
 * Does not delete profile data; masks unsafe public fields only.
 */
export function sanitizePublicTechnician<T extends {
  display_name: string; bio: string | null; region: string | null; neighborhood: string | null;
}>(profile: T): T {
  return {
    ...profile,
    display_name: publicTextProblem(profile.display_name, "identity") ? "Profissional cadastrado" : profile.display_name,
    bio: publicTextProblem(profile.bio, "bio") ? null : profile.bio,
    region: publicTextProblem(profile.region, "identity") ? null : profile.region,
    neighborhood: publicTextProblem(profile.neighborhood, "identity") ? null : profile.neighborhood,
  };
}
