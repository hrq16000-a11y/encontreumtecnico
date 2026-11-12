import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { isValidTechnicianSlug } from "@/lib/technician-id";
import { publicTextProblem } from "@/lib/public-profile-text";

export type CoverageSource = {
  public_slug: string | null;
  display_name: string;
  city: string;
  state_uf: string | null;
};

export type CoverageLocation = {
  uf: string;
  city: string;
  profiles: Array<{ slug: string; displayName: string }>;
};

const VALID_STATES = new Set<string>(BRAZIL_STATES);

/** A single actual approved base location counts once per public profile.
 * No inferred travel radius, IP/GPS, availability or unverified municipality claim.
 */
export function groupPublishedCoverage(records: readonly CoverageSource[]): CoverageLocation[] {
  const locations = new Map<string, CoverageLocation>();
  const seenSlugs = new Set<string>();
  for (const row of records) {
    const uf = (row.state_uf ?? "").trim().toUpperCase();
    const city = (row.city ?? "").trim().replace(/\s+/g, " ");
    const slug = row.public_slug ?? "";
    if (!VALID_STATES.has(uf) || !city || city.length > 100
      || publicTextProblem(city, "identity")
      || !isValidTechnicianSlug(slug) || publicTextProblem(slug, "identity")
      || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const cityKey = city.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
    const key = uf + ":" + cityKey;
    if (!locations.has(key)) locations.set(key, { uf, city, profiles: [] });
    const displayName = publicTextProblem(row.display_name, "identity")
      ? "Profissional cadastrado" : row.display_name.trim();
    locations.get(key)!.profiles.push({ slug, displayName });
  }
  return [...locations.values()]
    .map(location => ({ ...location, profiles: location.profiles.sort(
      (a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"),
    ) }))
    .sort((a,b) => a.uf.localeCompare(b.uf, "pt-BR")
      || a.city.localeCompare(b.city, "pt-BR"));
}

