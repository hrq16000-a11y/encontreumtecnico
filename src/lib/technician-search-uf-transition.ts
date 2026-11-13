import { clearPendingFilter } from "./pending-search-filter";

/**
 * Changing UF invalidates locality text typed for the previous state.
 * Remove same-tab unfinished drafts too, so a stale city/bairro cannot be
 * restored into the freshly cleared URL on mobile.
 * This only changes public search filters, never user profile location.
 */
export function technicianSearchAfterUfChange(
  nextUf: string,
  priorPriority: string,
  storage?: Storage,
) {
  for (const id of ["filtro-cidade", "filtro-bairro", "filtro-regiao"] as const) {
    clearPendingFilter(id, storage);
  }
  return {
    uf: nextUf,
    cidade: "",
    bairro: "",
    regiao: "",
    prioridade: nextUf && priorPriority === "regiao" ? "regiao" : "",
  };
}
