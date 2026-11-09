/** Slugs are stable identifiers. Never silently infer skills from old generic "TI" labels. */
export function serviceSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 75);
}

export function validMunicipality(uf: string | null, municipality: string | null): boolean {
  const states = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
  const city = (municipality ?? "").trim().toLowerCase();
  return states.has((uf ?? "").toUpperCase()) &&
    city.length >= 2 &&
    !["brasil","brazil","a confirmar","não informado","nao informado","unknown","-"].includes(city);
}

export const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
