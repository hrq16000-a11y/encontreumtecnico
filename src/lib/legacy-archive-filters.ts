/** Old WordPress records lack validated municipal and specialty-level coverage. */
export function canShowLegacyArchive(search: {
  especialidade?: string;
  cidade?: string;
  regiao?: string;
}) {
  return (!search.especialidade || search.especialidade === "Todas") &&
    !search.cidade?.trim() && !search.regiao?.trim();
}
