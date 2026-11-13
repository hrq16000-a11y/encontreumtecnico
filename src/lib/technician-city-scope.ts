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

/** Build real eligible pages from approved, municipality-scoped candidates.
 * Never mistake a candidate offset for an eligible offset. Bounded scanning
 * fails closed rather than claiming a city is empty or counts are exhaustive.
 */
export const MUNICIPAL_PAGE_SIZE = 50;
export const MUNICIPAL_MAX_PAGE = 20;
const SCAN_BATCH_SIZE = 100;
const MAX_SCAN_CANDIDATES = 5000;

export async function collectEligibleMunicipalPage<T extends { id: string }>({
  page, readCandidates, readEligible,
}: {
  page: number;
  readCandidates: (from: number, to: number) => Promise<T[]>;
  readEligible: (candidates: T[]) => Promise<T[]>;
}): Promise<{ rows: T[]; hasMore: boolean }> {
  if (!Number.isSafeInteger(page) || page < 1 || page > MUNICIPAL_MAX_PAGE)
    throw new Error("Página municipal inválida.");
  const startEligible = (page - 1) * MUNICIPAL_PAGE_SIZE;
  const sentinel = page * MUNICIPAL_PAGE_SIZE + 1;
  let seenEligible = 0;
  let from = 0;
  const selected: T[] = [];
  const seenCandidates = new Set<string>();
  while (from < MAX_SCAN_CANDIDATES) {
    const batchSize = Math.min(SCAN_BATCH_SIZE, MAX_SCAN_CANDIDATES - from);
    const candidates = await readCandidates(from, from + batchSize - 1);
    if (!Array.isArray(candidates) || candidates.length > batchSize)
      throw new Error("Resposta inválida da consulta municipal.");
    const batchIds = new Set<string>();
    for (const candidate of candidates) {
      if (!candidate || typeof candidate.id !== "string" || !candidate.id ||
          seenCandidates.has(candidate.id))
        throw new Error("Identidade duplicada ou ausente na consulta municipal.");
      seenCandidates.add(candidate.id);
      batchIds.add(candidate.id);
    }
    const eligible = candidates.length ? await readEligible(candidates) : [];
    if (!Array.isArray(eligible))
      throw new Error("Elegibilidade municipal indisponível.");
    const checked = new Set<string>();
    for (const row of eligible) {
      if (!row || !batchIds.has(row.id) || checked.has(row.id))
        throw new Error("Identidade elegível fora do lote municipal.");
      checked.add(row.id);
      seenEligible++;
      if (seenEligible > startEligible && seenEligible < sentinel) selected.push(row);
      if (seenEligible === sentinel) return { rows: selected, hasMore: true };
    }
    from += candidates.length;
    if (candidates.length < batchSize) return { rows: selected, hasMore: false };
  }
  // A full candidate budget is not a proven end of the eligible catalogue.
  throw new Error("Busca municipal excedeu o limite seguro de leitura. Refine os filtros.");
}
