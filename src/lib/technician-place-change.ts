import { placeKey } from "./location-labels";
import { suggestTechnicianArea, type CustomerArea } from "./customer-location";

/**
 * A city/UF change invalidates dependent neighborhood and extra coverage.
 * The form must obtain explicit consent before clearing a non-empty draft.
 * A same-municipality IBGE confirmation retains the user's exact text.
 */
export type TechnicianPlace = {
  state_uf: string;
  city: string;
  neighborhood: string;
  region: string;
  base_city_ibge_id: number | null;
};

export function isDifferentDeclaredMunicipality(
  current: TechnicianPlace,
  next: Pick<TechnicianPlace, "state_uf" | "city">,
): boolean {
  const ufChanged = Boolean(current.state_uf && current.state_uf !== next.state_uf);
  const cityChanged = Boolean(current.city.trim() && placeKey(current.city) !== placeKey(next.city));
  return ufChanged || cityChanged;
}

export function needsLocationDraftConfirmation(
  current: TechnicianPlace,
  next: Pick<TechnicianPlace, "state_uf" | "city">,
): boolean {
  return isDifferentDeclaredMunicipality(current, next) &&
    Boolean(current.neighborhood.trim() || current.region.trim());
}

export function changeTechnicianPlace<T extends TechnicianPlace>(
  current: T,
  next: Pick<TechnicianPlace, "state_uf" | "city" | "base_city_ibge_id">,
): T {
  const locationChanged = isDifferentDeclaredMunicipality(current, next);
  return {
    ...current,
    state_uf: next.state_uf,
    city: next.city,
    base_city_ibge_id: next.base_city_ibge_id,
    neighborhood: locationChanged ? "" : current.neighborhood,
    region: locationChanged ? "" : current.region,
  };
}

/** Preview the device suggestion without mutating a draft or trusting GPS as IBGE.
 * Caller must obtain confirmation before applying any changed dependent fields.
 */
export function previewTechnicianAreaSuggestion<T extends TechnicianPlace>(
  current: T, area: CustomerArea, source: "manual" | "automatic",
): { next: T; requiresConfirmation: boolean } {
  const suggested = suggestTechnicianArea(current, area, source);
  if (suggested === current) return { next: current, requiresConfirmation: false };
  const changed = isDifferentDeclaredMunicipality(current, suggested);
  const next = changeTechnicianPlace(current, {
    state_uf: suggested.state_uf,
    city: suggested.city,
    base_city_ibge_id: changed ? null : current.base_city_ibge_id,
  });
  return {
    next: { ...next, neighborhood: changed ? "" : suggested.neighborhood },
    requiresConfirmation: needsLocationDraftConfirmation(current, suggested),
  };
}
