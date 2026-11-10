/**
 * Aceita um telefone brasileiro nacional completo:
 * - 10 dígitos: DDD (2) + fixo (8)
 * - 11 dígitos: DDD (2) + celular (9)
 * Pode vir com +55/55 e pontuação usual; o DDD é obrigatório.
 *
 * Retorna E.164 para o RPC privado, nunca para URLs ou perfis públicos.
 * Não comprova titularidade nem garante que o número tenha WhatsApp.
 */
export function normalizeBrazilianPhone(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.length > 40 || !/^\+?[0-9\s().-]+$/.test(raw)) return null;

  const digits = raw.replace(/\D/g, "");
  // Somente + marca o país de forma inequívoca: "55 " pode ser
  // um telefone nacional do DDD 55 e deve continuar aceito.
  const explicitCountryCode = raw.startsWith("+");
  if (explicitCountryCode && !digits.startsWith("55")) return null;
  const national = explicitCountryCode
    ? digits.slice(2)
    : digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;

  // Correspondente ao validador do RPC eut_save_my_private_contact.
  if (!/^[1-9]{2}[2-9][0-9]{7,8}$/.test(national)) return null;
  return `+55${national}`;
}
