/** Local-only filtering of the directory's service dropdown.
 * Never changes URL params, server queries or the currently chosen service.
 * A selected service remains available to clear even when a search excludes it.
 */
const fold = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function directoryServiceChoices<T extends { slug: string; label: string; category_slug: string }>(
  services: readonly T[],
  categories: readonly { slug: string; label: string }[],
  specialty: string,
  query: string,
  selectedSlug: string,
): T[] {
  const term = fold(query.trim());
  const categoryLabels = new Map(categories.map(category => [category.slug, category.label]));
  return services.filter(service => {
    // The specialty's official scope always wins, including for stale selections.
    if (specialty !== "Todas" && service.category_slug !== specialty) return false;
    if (!term || service.slug === selectedSlug) return true;
    return fold(`${service.label} ${service.slug} ${categoryLabels.get(service.category_slug) ?? ""}`).includes(term);
  });
}
