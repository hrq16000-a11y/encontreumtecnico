/**
 * Dados do WordPress ainda não têm UF, cidade, bairro, serviço ou especialidade
 * confirmados. O acervo só pode aparecer na busca SEM FILTROS.
 *
 * Isso evita sugerir incorretamente que um cadastro histórico atende a região
 * ou realiza um serviço que o titular ainda não confirmou.
 */
export function canShowLegacyArchive(search: {
  especialidade?: string;
  cidade?: string;
  regiao?: string;
  servico?: string;
  uf?: string;
  bairro?: string;
}) {
  const category = (search.especialidade ?? "").trim();
  return (!category || category === "Todas") &&
    !search.cidade?.trim() &&
    !search.regiao?.trim() &&
    !search.servico?.trim() &&
    !search.uf?.trim() &&
    !search.bairro?.trim();
}
