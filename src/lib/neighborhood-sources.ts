import { placeKey, sameMunicipalityAsNeighborhood } from "./location-labels";

/**
 * Prefeitura de São José dos Pinhais, "Mapas do Município".
 * Consultado em 11/11/2026: https://www.sjp.pr.gov.br/mapas-do-municipio/
 * Lista municipal de referência, sujeita a atualizações. Não confirma o endereço
 * ou o bairro onde o titular reside. A digitação livre permanece obrigatória.
 * "Itália" consta nesta fonte; "Jardim Itália" pode ser escrito pelo titular.
 */
export type NeighborhoodCatalog = {
  municipalityIbgeId: number;
  municipalityName: string;
  uf: string;
  sourceName: string;
  sourceUrl: string;
  neighborhoods: readonly string[];
};

const CATALOGS: readonly NeighborhoodCatalog[] = [{
  municipalityIbgeId: 4125506,
  municipalityName: "São José dos Pinhais",
  uf: "PR",
  sourceName: "Prefeitura de São José dos Pinhais",
  sourceUrl: "https://www.sjp.pr.gov.br/mapas-do-municipio/",
  neighborhoods: [
  "Academia",
  "Área Institucional Aeroportuária",
  "Afonso Pena",
  "Águas Belas",
  "Aristocrata",
  "Arujá",
  "Aviação",
  "Barro Preto",
  "Bom Jesus",
  "Boneca do Iguaçu",
  "Borda do Campo",
  "Cachoeira",
  "Campina do Taquaral",
  "Campo Largo da Roseira",
  "Centro",
  "Cidade Jardim",
  "Colônia Rio Grande",
  "Contenda",
  "Costeira",
  "Cristal",
  "Cruzeiro",
  "Del Rey",
  "Dom Rodrigo",
  "Guatupê",
  "Iná",
  "Ipê",
  "Itália",
  "Jurema",
  "Miringuava",
  "Ouro Fino",
  "Parque da Fonte",
  "Pedro Moro",
  "Quissisana",
  "Rio Pequeno",
  "Roseira de São Sebastião",
  "Santo Antônio",
  "São Cristóvão",
  "São Domingos",
  "São Marcos",
  "São Pedro",
  "Zacarias"
] as const,
}];

export function neighborhoodCatalogFor(input: {
  city: string;
  uf: string;
  municipalityIbgeId?: number | null;
}): NeighborhoodCatalog | null {
  const city = placeKey(input.city);
  const uf = input.uf.trim().toUpperCase();
  if (!city || !uf) return null;
  return CATALOGS.find(catalog =>
    catalog.uf === uf && placeKey(catalog.municipalityName) === city &&
    (input.municipalityIbgeId == null || input.municipalityIbgeId === catalog.municipalityIbgeId)
  ) ?? null;
}

export function neighborhoodOptions(catalog: NeighborhoodCatalog | null): readonly string[] {
  if (!catalog) return [];
  return catalog.neighborhoods.filter(name => !sameMunicipalityAsNeighborhood(name, catalog.municipalityName));
}
