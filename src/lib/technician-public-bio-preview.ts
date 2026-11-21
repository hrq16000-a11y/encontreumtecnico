import { parseProfessionalBio } from "./technician-profile-enrichment";
import { publicTextProblem } from "./public-profile-text";

/** Short, factual excerpt from the sanitized public bio only.
 * Never infers experience, ratings, prices or availability from empty headings.
 * A defensive output check also covers stale/migrated public records.
 */
export function publicTechnicianBioPreview(bio: string | null | undefined): string | null {
  if (!bio?.trim() || publicTextProblem(bio, "bio")) return null;
  const { introduction, sections } = parseProfessionalBio(bio);
  const firstSection = sections.find(section => section.text.trim());
  const candidate = introduction.trim() || (firstSection ? `${firstSection.label}: ${firstSection.text}` : "");
  const text = candidate.replace(/\s+/gu, " ").trim();
  if (!text) return null;

  const limit = 165;
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  const prefix = chars.slice(0, limit + 1).join("");
  const lastSpace = prefix.lastIndexOf(" ");
  const shortened = lastSpace >= 110 ? prefix.slice(0, lastSpace) : chars.slice(0, limit).join("");
  return shortened.replace(/[\s,;:.-]+$/u, "") + "…";
}
