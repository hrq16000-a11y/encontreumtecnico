import { placeKey } from "./location-labels";
export type OfficialMunicipalityRecord = { id: number; name: string; uf: string };
/** Check URL input against an official ID, name and state; never guess by DDD or GPS. */
export function matchingOfficialMunicipalityId(
  idText: string, municipality: OfficialMunicipalityRecord | null,
  uf: string, city: string,
): number | null {
  if (!/^[1-9][0-9]{6}$/.test(idText) || !municipality ||
      municipality.id !== Number(idText) || municipality.uf !== uf.toUpperCase() ||
      !city.trim() || placeKey(municipality.name) !== placeKey(city)) return null;
  return municipality.id;
}
