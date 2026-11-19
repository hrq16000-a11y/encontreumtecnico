/** Bound each administrative directory page on mobile and desktop. */
export const UNIFIED_DIRECTORY_PAGE_SIZE = 18;

export function unifiedPageCount(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / UNIFIED_DIRECTORY_PAGE_SIZE));
}

export function unifiedPageSlice<T>(rows: readonly T[], page: number): T[] {
  const start = Math.max(0, Math.trunc(page)) * UNIFIED_DIRECTORY_PAGE_SIZE;
  return rows.slice(start, start + UNIFIED_DIRECTORY_PAGE_SIZE);
}

/** Short normalized fragment for cross-source specialty text, without guessing a category. */
export function categoryKeyword(value: string): string {
  const words = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return (words.find((word) => !["tecnico", "tecnica", "servicos", "servico", "especialidade", "especialidades"].includes(word)) ?? words[0] ?? "").slice(0, 4);
}
