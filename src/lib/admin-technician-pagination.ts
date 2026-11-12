/** Bounded, server-side paging for the administrative technician directory. */
export const ADMIN_TECHNICIAN_PAGE_SIZE = 25;
export function adminPageRange(page: number): [number, number] {
  const safePage = Number.isSafeInteger(page) && page >= 0 ? Math.min(page, 100_000) : 0;
  const first = safePage * ADMIN_TECHNICIAN_PAGE_SIZE;
  return [first, first + ADMIN_TECHNICIAN_PAGE_SIZE - 1];
}
export function cleanAdminSearch(value: string): string {
  // Never allow a user-provided wildcard to turn an exact filter into
  // a broad unauthorized query. RLS is still the ultimate guard.
  return value.replace(/[%_*,()\\]/g, " ").trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Last valid zero-based page of a server-backed admin list, including empty lists. */
export function adminLastPageIndex(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(pageSize) || pageSize <= 0) return 0;
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}

/** Keep refresh/moderation results on a valid page without requesting every account. */
export function boundedAdminPage(page: number, total: number, pageSize: number): number {
  const safe = Number.isSafeInteger(page) && page >= 0 ? page : 0;
  return Math.min(safe, adminLastPageIndex(total, pageSize));
}
