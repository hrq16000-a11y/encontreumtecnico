/**
 * Transparent local relevance. These are ONLY user-entered, owner-declared
 * municipality/UF/neighborhood strings, not GPS, distances or identity checks.
 * Service/category compatibility is enforced by the caller before ranking.
 */
export type DeclaredArea = { uf: string; cidade: string; bairro: string };
export type AreaTechnician = {
  state_uf: string | null;
  city: string;
  neighborhood: string | null;
  coverage_cities?: Array<{ id: number; name: string; uf: string }>;
  online_now: boolean;
  pioneer_bronze?: boolean;
  referral_highlight?: boolean;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function localMatchLevel(technician: AreaTechnician, area: DeclaredArea): 0 | 1 | 2 | 3 {
  const uf = normalized(area.uf);
  const city = normalized(area.cidade);
  const neighborhood = normalized(area.bairro);
  const stateMatches = Boolean(uf) && normalized(technician.state_uf) === uf;
  // If a UF is given, an identically named municipality in another UF is NOT nearby.
  const baseCityMatches = Boolean(city) && (!uf || stateMatches)
    && normalized(technician.city) === city;
  const declaredCoverageMatches = Boolean(city) &&
    (technician.coverage_cities ?? []).some((covered) =>
      normalized(covered.name) === city && (!uf || normalized(covered.uf) === uf));
  const cityMatches = baseCityMatches || declaredCoverageMatches;
  // A named extra city must not inherit the base city's neighborhood.
  const neighborhoodMatches = baseCityMatches && Boolean(neighborhood)
    && normalized(technician.neighborhood) === neighborhood;

  if (neighborhoodMatches) return 3;
  if (cityMatches) return 2;
  if (stateMatches) return 1;
  return 0;
}

export function localMatchLabel(technician: AreaTechnician, area: DeclaredArea): string | null {
  const level = localMatchLevel(technician, area);
  if (level === 3) return "Mesmo bairro informado";
  if (level === 2) return normalized(technician.city) === normalized(area.cidade)
    ? "Mesma cidade-base informada" : "Cidade atendida declarada";
  if (level === 1) return "Mesmo estado informado";
  return null;
}

export function rankTechniciansByDeclaredArea<T extends AreaTechnician>(
  technicians: T[],
  area: DeclaredArea,
): T[] {
  // Always sort a copy; original order is server-retrieved recency and is
  // preserved on a tie. Online is a tiebreaker AFTER location relevance.
  return technicians.map((technician, index) => ({
    technician,
    index,
    locationLevel: localMatchLevel(technician, area),
  })).sort((a, b) =>
    b.locationLevel - a.locationLevel ||
    Number(b.technician.online_now) - Number(a.technician.online_now) ||
    // Nearby services and online availability always outrank referral rewards.
    Number(Boolean(b.technician.referral_highlight)) - Number(Boolean(a.technician.referral_highlight)) ||
    Number(Boolean(b.technician.pioneer_bronze)) - Number(Boolean(a.technician.pioneer_bronze)) ||
    a.index - b.index
  ).map((item) => item.technician);
}
