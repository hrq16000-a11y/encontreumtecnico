import { sanitizePublicTechnician } from "./public-profile-text";

/** Presentation-only normalization AFTER both RLS and the database
 * eligibility RPC have admitted the profile. No JavaScript access checks.
 * R2 permits administratively created rows with nullable name and city.
 * DDD never implies municipality or coverage.
 */
export function toSafePublicTechnician<T extends {
  display_name: string | null;
  city: string | null;
  bio: string | null;
  region: string | null;
  neighborhood: string | null;
}>(row: T): Omit<T, "display_name" | "city"> & {
  display_name: string;
  city: string;
} {
  const display_name = typeof row.display_name === "string" && row.display_name.trim()
    ? row.display_name.trim()
    : "Profissional cadastrado";
  const city = typeof row.city === "string" ? row.city.trim() : "";
  return sanitizePublicTechnician({ ...row, display_name, city });
}

/** A blank city is absence of information, never geolocation inferred by DDD. */
export function publicLocationOrFallback(location: string): string {
  return location.trim() || "Localidade não informada";
}
