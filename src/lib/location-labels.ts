/** Shared, conservative display rules for distinct geographic levels.
 * Never infer a neighborhood from a municipality or regional label.
 * This only affects presentation/validated drafts, not legacy database rows.
 */
export function placeKey(raw: string | null | undefined): string {
  return (raw ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

export function sameMunicipalityAsNeighborhood(neighborhood: string | null | undefined,
  city: string | null | undefined): boolean {
  const a = placeKey(neighborhood), b = placeKey(city);
  return Boolean(a && b && (a === b || a === placeKey((city ?? "") + "/PR") ||
    /^[a-z\s-]+\/([a-z]{2})$/i.test(neighborhood ?? "") && a.split("/")[0] === b));
}

export function safeNeighborhood(neighborhood: string | null | undefined,
  city: string | null | undefined): string {
  const value = (neighborhood ?? "").trim();
  return sameMunicipalityAsNeighborhood(value, city) ? "" : value;
}

export function isBroadRegionalLabel(raw: string | null | undefined): boolean {
  return /^(?:regi[aã]o\s+metropolitana\s+(?:de|do|da)|grande\s+|interior\s+(?:de|do|da)|[a-z\s]+\s+e\s+regi[aã]o$)/i
    .test((raw ?? "").trim());
}

/** One short distinct location line for public cards and profile hero. */
export function formatPublicLocation(value: {
  city: string; state_uf?: string | null; neighborhood?: string | null; region?: string | null;
}): string {
  const city = value.city.trim();
  const uf = value.state_uf?.trim() ?? "";
  const cityLabel = [city, uf].filter(Boolean).join("/");
  const bits = [cityLabel];
  const neighborhood = safeNeighborhood(value.neighborhood, city);
  if (neighborhood && placeKey(neighborhood) !== placeKey(cityLabel)) bits.push(neighborhood);
  const region = value.region?.trim() ?? "";
  const known = new Set(bits.map(placeKey));
  // The region is a free-text area description, not a source of new city/bairro.
  // Only remove identical full labels; do not split or manufacture coverage.
  if (region && !known.has(placeKey(region)) &&
      placeKey(region) !== placeKey(city) && placeKey(region) !== placeKey(cityLabel))
    bits.push(region);
  return bits.filter(Boolean).join(" · ");
}
