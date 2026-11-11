# EUT — catálogo de sugestões de bairros por município (piloto)

Data de inspeção das fontes: 2026-11-11.

## Fontes e distinções
- Municípios (identidade e UF) continuam usando a base de códigos IBGE já
  incorporada ao cadastro: `eut_ibge_municipalities`. O município-base deve
  ser escolhido/confirmado; o GPS é apenas sugestão.
- Para **São José dos Pinhais/PR, IBGE 4125506**, as sugestões locais em
  `src/lib/neighborhood-sources.ts` refletem os nomes mostrados em
  https://www.sjp.pr.gov.br/mapas-do-municipio/ (consulta em 11/11/2026).
  São nomes de referência para autocomplete, não certificação de endereço.
- A Prefeitura lista **"Itália"**, enquanto o titular pode preferir a
  denominação **"Jardim Itália"**. A interface NÃO substitui uma pela outra.
- A nomenclatura de bairros não é padronizada nacionalmente; nomes informais,
  loteamentos e alterações legais podem diferir do catálogo. Referência
  conceitual: IBGE, Quadro Geográfico de Referência.
- A API Busca CEP de Correios lista bairros por município, mas requer
  credenciais de contrato. Nenhuma chave ou chamada externa foi ativada.
  Referência: https://www.correios.com.br/atendimento/developers/manuais/manual-api-busca-cep

## Regra de implantação nacional
1. Anexar somente fontes verificadas e atribuíveis a um município/UF/código IBGE.
2. Usar snapshots versionados no GitHub, com URL e data da fonte; revisão humana
   para grafias e atualização; nenhum scraping periódico no navegador.
3. Não aceitar `locality`, GPS, IP ou região metropolitana como bairro.
4. Autocomplete é **opcional**; permitir digitação livre em todos os municípios,
   sem declarar que um valor digitado foi verificado por terceiros.
5. Nunca acrescentar valor ao campo `bairro` sem escolha/digitação explícita.
   Preservar rascunhos e não reescrever perfis publicados ou históricos.
6. Quando não houver catálogo verificado, não apresentar sugestões inventadas.
7. Bairros não são novas URLs de SEO por padrão. URLs de município, perfil e
   categoria devem seguir os gates já existentes de privacidade/SSR/canonical.

## Homologação da rodada
- Validar banco de municípios, testes da Home/LP2, catálogo, rascunhos,
  privacidade e sessões com gates GitHub antes de merge.
- Não modificar SQL, Supabase, DNS, WordPress, Lovable, cadastros nem banimentos.
- Homologação de uso real em mobile e no perfil do titular permanece separada dos gates.
