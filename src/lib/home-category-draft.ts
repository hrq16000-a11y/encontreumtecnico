import { saveUiTextDraft } from "./unsent-ui-draft";

/** A category change must preserve the municipality ID as part of the same
 * short-lived, non-sensitive search draft. Saving replaces the whole slot.
 * The ID is only a hint until the current official IBGE list revalidates it.
 */
export function saveHomeCategoryDraft(
  specialty: string,
  location: {
    city: string;
    uf: string;
    neighborhood: string;
    cityId: number | null;
  },
  storage?: Storage,
): boolean {
  return saveUiTextDraft("home", {
    specialty,
    city: location.city,
    uf: location.uf,
    neighborhood: location.neighborhood,
    cityid: location.cityId === null ? "" : String(location.cityId),
  }, storage);
}
