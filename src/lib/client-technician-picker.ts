import { isValidTechnicianId } from "./technician-id";
import type { PublicTechnician } from "./technicians.functions";

/** UI-only shortlist. Publication and account privacy are enforced by the
 * server; no unapproved profile or contact field is introduced here. */
export function publishedTechnicianSuggestions(
  profiles: readonly PublicTechnician[],
  category: string,
  maxResults = 5,
): PublicTechnician[] {
  if (!category || maxResults < 1) return [];
  return profiles.filter((profile) =>
    isValidTechnicianId(profile.id) && profile.specialties.includes(category),
  ).slice(0, Math.min(maxResults, 8));
}
