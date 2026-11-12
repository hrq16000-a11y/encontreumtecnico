/** Localidades para consulta; esta lista não garante disponibilidade de profissionais. */
export type CoverageCity = Readonly<{ uf: string; cidade: string }>;

export const CAPITAL_CITIES: readonly CoverageCity[] = [
  { uf: "AC", cidade: "Rio Branco" },
  { uf: "AL", cidade: "Maceió" },
  { uf: "AP", cidade: "Macapá" },
  { uf: "AM", cidade: "Manaus" },
  { uf: "BA", cidade: "Salvador" },
  { uf: "CE", cidade: "Fortaleza" },
  { uf: "DF", cidade: "Brasília" },
  { uf: "ES", cidade: "Vitória" },
  { uf: "GO", cidade: "Goiânia" },
  { uf: "MA", cidade: "São Luís" },
  { uf: "MT", cidade: "Cuiabá" },
  { uf: "MS", cidade: "Campo Grande" },
  { uf: "MG", cidade: "Belo Horizonte" },
  { uf: "PA", cidade: "Belém" },
  { uf: "PB", cidade: "João Pessoa" },
  { uf: "PR", cidade: "Curitiba" },
  { uf: "PE", cidade: "Recife" },
  { uf: "PI", cidade: "Teresina" },
  { uf: "RJ", cidade: "Rio de Janeiro" },
  { uf: "RN", cidade: "Natal" },
  { uf: "RO", cidade: "Porto Velho" },
  { uf: "RR", cidade: "Boa Vista" },
  { uf: "RS", cidade: "Porto Alegre" },
  { uf: "SC", cidade: "Florianópolis" },
  { uf: "SE", cidade: "Aracaju" },
  { uf: "SP", cidade: "São Paulo" },
  { uf: "TO", cidade: "Palmas" },
];

/** Localidades informadas como presença de parceiros pela administração em 10/11/2026.
 * Quatro capitais aparecem também aqui, de propósito: há dois recortes distintos.
 * Não use estes dados para afirmar profissional ativo, verificado ou disponível.
 */
export const PARTNER_CITIES_BY_STATE: Readonly<Record<string, readonly string[]>> = {
  AC: ["Rio Branco"],
  AL: ["Coruripe"],
  AM: ["Itacoatiara"],
  BA: ["Bom Jesus da Lapa", "Tucano", "Poções", "Conceição do Coité", "Jequié", "Santo Antônio de Jesus", "Valença", "Cruz das Almas"],
  CE: ["Aracati", "Tianguá", "Maracanaú"],
  ES: ["Nova Venécia", "Colatina", "São Mateus"],
  GO: ["Rio Verde", "Mineiros"],
  MA: ["Barreirinhas", "Imperatriz"],
  MG: ["Juiz de Fora", "Poços de Caldas", "Muriaé", "Três Corações", "Além Paraíba", "Salinas", "Visconde do Rio Branco"],
  MS: ["Dourados", "Sidrolândia", "Naviraí"],
  MT: ["Cuiabá"],
  PA: ["Abaetetuba", "Paragominas", "Santarém", "Cametá", "Barcarena", "Altamira", "Bragança"],
  PB: ["Campina Grande"],
  PE: ["Araripina", "Salgueiro"],
  PI: ["Campo Maior", "Altos"],
  PR: ["Medianeira", "Londrina", "Cascavel", "Paranaguá", "Arapongas", "Cambé", "Francisco Beltrão", "Marechal Cândido Rondon"],
  RJ: ["Magé", "Resende", "Saquarema", "Três Rios", "Barra do Piraí", "Seropédica", "Campos dos Goytacazes", "Mangaratiba", "Volta Redonda", "Macaé"],
  RO: ["Porto Velho", "Vilhena"],
  RR: ["Boa Vista"],
  RS: ["Gravataí", "Santa Maria", "Rio Grande", "Santa Cruz do Sul", "Tramandaí", "Pelotas", "Vacaria"],
  SC: ["Tubarão", "Canoinhas"],
  SP: ["Presidente Venceslau", "Nova Odessa", "São Manuel", "Lins", "Andradina"],
};

export const PARTNER_CITY_COUNT = Object.values(PARTNER_CITIES_BY_STATE)
  .reduce((total, cities) => total + cities.length, 0);

export const DISTINCT_COVERAGE_CITY_COUNT = new Set([
  ...CAPITAL_CITIES.map(({ uf, cidade }) => uf + "|" + cidade),
  ...Object.entries(PARTNER_CITIES_BY_STATE).flatMap(([uf, cities]) =>
    cities.map((cidade) => uf + "|" + cidade)),
]).size;
