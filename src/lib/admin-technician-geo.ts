import { normalizeBrazilPhoneE164, type AdminCity } from "./admin-technician-crud-intent";

/** Only an exact, unique municipality from the official catalogue can be preselected. */
export function verifiedBaseCity(
  city: string,
  uf: string | null,
  municipalities: readonly AdminCity[],
): AdminCity | null {
  if (!uf || !city.trim()) return null;
  const matches = municipalities.filter(
    (municipality) =>
      municipality.uf === uf &&
      municipality.name.trim().toLocaleLowerCase("pt-BR") ===
        city.trim().toLocaleLowerCase("pt-BR"),
  );
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** DDD is a telephone-region indicator, never proof of a technician's city. */
export function dddFromBrazilPhone(input: string): string | null {
  const normalized = normalizeBrazilPhoneE164(input);
  return normalized ? normalized.slice(3, 5) : null;
}
