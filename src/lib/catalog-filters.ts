export type FilterableCatalog = {
  categories: { slug: string; label: string }[];
  services: { slug: string; category_slug: string; label: string }[];
};

const OLD_CATEGORY_SLUGS: Record<string, string> = {
  "Ar-condicionado": "climatizacao",
  "Automação": "automacao",
  "CFTV": "cftv",
  "Computador": "computadores",
  "Comunicações": "comunicacoes",
  "Elétrica": "eletrica",
  "Gráfica": "design-grafico",
  "Impressora": "impressoras",
};

// The public links from earlier releases use old category names.
// They can still be opened but only map to reviewed live-catalog services.
export function normalizeCatalogSelection(filter: string, catalog: FilterableCatalog): string {
  const mapped = OLD_CATEGORY_SLUGS[filter];
  const value = mapped ? `cat:${mapped}` : filter;
  if (value === "Todas") return "Todas";
  if (value.startsWith("cat:") && catalog.categories.some(c => c.slug === value.slice(4))) return value;
  if (value.startsWith("svc:") && catalog.services.some(s => s.slug === value.slice(4))) return value;
  return "Todas";
}

// null means no filter; [] means unknown / inactive and must return NO technicians.
export function resolveCatalogLabels(filter: string, catalog: FilterableCatalog): string[] | null {
  if (!filter || filter === "Todas") return null;
  const value = OLD_CATEGORY_SLUGS[filter] ? `cat:${OLD_CATEGORY_SLUGS[filter]}` : filter;
  if (value.startsWith("cat:")) {
    const category = value.slice(4);
    if (!catalog.categories.some(c => c.slug === category)) return [];
    return catalog.services.filter(s => s.category_slug === category).map(s => s.label);
  }
  if (value.startsWith("svc:")) {
    const service = catalog.services.find(s => s.slug === value.slice(4));
    return service ? [service.label] : [];
  }
  return [];
}
