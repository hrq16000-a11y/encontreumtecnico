import { normalizeChoice, rankChoices, type ChoiceOption } from "./searchable-options";
type Category = { slug: string; label: string; description?: string | null };
type Service = { slug: string; label: string; category_slug: string };

export function discoveryChoices(categories: readonly Category[], services: readonly Service[]): ChoiceOption[] {
  const labels = new Map(categories.map(category => [category.slug, category.label]));
  return [
    ...categories.map(category => ({ value: category.slug, label: category.label, keywords: category.description ?? "" })),
    ...services.filter(service => labels.has(service.category_slug)).map(service => ({
      value: "service:" + service.slug, label: service.label, detail: labels.get(service.category_slug), keywords: service.slug,
    })),
  ];
}

/** Submission is a deliberate confirmation only for unambiguous catalogue matches.
 * Unknown or ambiguous text must never silently become a nationwide/all-service search. */
export function resolveDiscoveryChoice(
  options: readonly ChoiceOption[], typed: string, selected: string,
  categories: readonly Category[], services: readonly Service[],
): { especialidade: string; servico: string } | null {
  const text = normalizeChoice(typed);
  if (!text && !selected) return { especialidade: "Todas", servico: "" };
  const confirmed = options.find(option => option.value === selected && (!text || normalizeChoice(option.label) === text));
  const exact = options.filter(option => normalizeChoice(option.label) === text);
  const ranked = rankChoices(options, typed);
  const option = confirmed ?? (exact.length === 1 ? exact[0] : ranked.length === 1 ? ranked[0] : undefined);
  if (!option) return null;
  if (option.value.startsWith("service:")) {
    const service = services.find(item => "service:" + item.slug === option.value);
    return service && categories.some(category => category.slug === service.category_slug)
      ? { especialidade: service.category_slug, servico: service.slug } : null;
  }
  return categories.some(category => category.slug === option.value)
    ? { especialidade: option.value, servico: "" } : null;
}
