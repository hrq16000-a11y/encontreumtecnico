import type { Municipality } from "@/hooks/use-municipalities";

export type LocationFieldValue = {
  uf: string;
  city: string;
  municipalityIbgeId: number | null;
  neighborhood: string;
  postalCode: string;
};
export type CepLookup = {
  erro?: boolean; cep?: string; ibge?: string; uf?: string;
  localidade?: string; bairro?: string;
};
const normalize = (text: string) => text.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

/** An IP hint is only offered when the IBGE list contains one exact match. */
export function findOfficialHint(cities: readonly Municipality[], city: string, uf: string): Municipality | null {
  if (!city || !uf) return null;
  const matches = cities.filter(item => item.uf === uf && normalize(item.name) === normalize(city));
  return matches.length === 1 ? matches[0]! : null;
}

/** CEP is a lookup key, never trusted text or a replacement for official municipality validation. */
export function verifiedCepFor(location: LocationFieldValue, raw: string, response: CepLookup): {
  cep: string; neighborhood: string;
} | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8 || response.erro === true ||
      location.municipalityIbgeId === null || !location.city || !location.uf ||
      response.ibge !== String(location.municipalityIbgeId) ||
      response.uf !== location.uf ||
      normalize(response.localidade ?? "") !== normalize(location.city) ||
      response.cep?.replace(/\D/g, "") !== digits) return null;
  return { cep: digits, neighborhood: (response.bairro ?? "").trim().slice(0, 100) };
}
