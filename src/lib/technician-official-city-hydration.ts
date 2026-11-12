import { placeKey } from "./location-labels";

export type OfficialMunicipality = { id: number; name: string; uf: string };

/**
 * Reconcile a restored/pre-existing technician city with the official IBGE
 * catalogue even when the registration wizard is on step 3 and the picker
 * (which is mounted only on step 1) was never opened.
 *
 * Never guess a municipality from GPS, approximate names, a different UF or
 * multiple catalogue matches. Preserve an explicit choice from the owner.
 */
export function hydrateTechnicianOfficialCity<T extends {
  state_uf: string; city: string; base_city_ibge_id: number | null;
}>(
  form: T, officialCities: readonly OfficialMunicipality[], loadedUf: string,
): T {
  if (form.base_city_ibge_id !== null || !form.city.trim() ||
      !form.state_uf || form.state_uf !== loadedUf) return form;
  const name = placeKey(form.city);
  const matches = officialCities.filter(city =>
    Number.isInteger(city.id) && city.id >= 1000000 && city.id <= 9999999 &&
    city.uf === form.state_uf && placeKey(city.name) === name,
  );
  return matches.length === 1
    ? { ...form, base_city_ibge_id: matches[0].id }
    : form;
}
