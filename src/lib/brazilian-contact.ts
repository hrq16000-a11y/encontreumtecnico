/**
 * Accepts Brazilian landline (DDD + 8 digits) and mobile
 * (DDD + 9 digits) numbers. Mirrors the server-side validation in
 * eut_save_my_private_contact while retaining the user's contact privacy.
 *
 * No external validation calls and no user-entered number in logs or URLs.
 */
export function normalizeBrazilianContact(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 40 || !/^\+?[0-9 ()\-.]+$/.test(value)) return null;

  const digits = value.replace(/[^0-9]/g, "");
  const international = digits.startsWith("55") && (digits.length === 12 || digits.length === 13);
  if (value.startsWith("+") && !international) return null;

  const national = international ? digits.slice(2) : digits;
  if (!/^[1-9]{2}[2-9][0-9]{7,8}$/.test(national)) return null;
  return "+55" + national;
}
