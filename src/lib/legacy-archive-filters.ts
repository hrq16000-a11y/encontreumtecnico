/** Old WordPress records lack validated municipal and specialty-level coverage. */
export function canShowLegacyArchive(search: {
  especialidade?: string;
  cidade?: string;
  regiao?: string;
  uf?: string;
  bairro?: string;
}) {
  return (!search.especialidade || search.especialidade === "Todas") &&
    !search.cidade?.trim() && !search.regiao?.trim() &&
    !search.uf?.trim() && !search.bairro?.trim();
}
