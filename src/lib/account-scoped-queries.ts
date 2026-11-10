/**
 * Isolate private client/technician data when the account changes in the same
 * browser tab. A stale async query must not replace the next user's state.
 */
export function canAcceptAccountResult(
  ownerId: string,
  currentUserId: string | null | undefined,
  queryVersion: number,
  currentVersion: number,
): boolean {
  return Boolean(currentUserId) && ownerId === currentUserId && queryVersion === currentVersion;
}

export function accountScopedRows<T>(
  rows: T[] | null,
  rowsOwnerId: string | null,
  viewerUserId: string | null | undefined,
): T[] | null {
  return viewerUserId && rowsOwnerId === viewerUserId ? rows : null;
}
