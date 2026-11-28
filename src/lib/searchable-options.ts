export interface ChoiceOption {
  value: string;
  label: string;
  detail?: string;
  displayLabel?: string;
  keywords?: string;
}

export function normalizeChoice(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[-–—]/g, " ").trim().replace(/\s+/g, " ");
}

// Stable ranking, independent of browser locale or search order. A result is
// a suggestion only; a canonical value changes on explicit confirmation.
export function rankChoices(options: readonly ChoiceOption[], query: string, limit = 8): ChoiceOption[] {
  const needle = normalizeChoice(query);
  if (!needle) return options.slice(0, limit);
  const tokens = needle.split(" ");
  return options.flatMap((option, index) => {
    const label = normalizeChoice(option.label);
    const value = normalizeChoice(option.value.replace(/-/g, " "));
    const corpus = normalizeChoice([option.label, option.detail, option.keywords, value].filter(Boolean).join(" "));
    if (!tokens.every(token => corpus.includes(token))) return [];
    const score = label === needle || value === needle ? 0
      : label.startsWith(needle) ? 1
      : label.split(" ").some(word => word.startsWith(needle)) ? 2
      : label.includes(needle) ? 3 : 4;
    return [{ option, index, score }];
  }).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map(result => result.option);
}
