/**
 * The public directory has two independently paginated, moderated sources.
 * Regional ordering must inspect BOTH sources before selecting a display page.
 * Stop with an explicit error if a source grows beyond the supported ceiling;
 * returning a partially ranked list would silently bury nearby technicians.
 */
export async function collectPublicDirectoryPages<T>(
  readPage: (offset: number, limit: number) => Promise<readonly T[]>,
  batchSize: number,
  ceiling: number,
): Promise<T[]> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 ||
    !Number.isSafeInteger(ceiling) || ceiling < batchSize || ceiling % batchSize !== 0) {
    throw new Error("Invalid public directory pagination contract");
  }
  const all: T[] = [];
  // The extra page acts as a sentinel if the catalog reached the ceiling.
  for (let offset = 0; offset <= ceiling; offset += batchSize) {
    const page = await readPage(offset, batchSize);
    if (page.length > batchSize) throw new Error("Public directory exceeded page size");
    if (offset === ceiling && page.length) {
      throw new Error("Public directory requires server-side ranking partitioning");
    }
    all.push(...page);
    if (page.length < batchSize) break;
  }
  return all;
}

/** Slice only AFTER moderation, source unification and regional ordering. */
export function publicDirectoryPage<T>(ranked: readonly T[], page: number, size = 100): T[] {
  return ranked.slice((page - 1) * size, page * size);
}
