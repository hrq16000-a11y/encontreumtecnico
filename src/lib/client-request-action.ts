/**
 * Client-side safeguard against actions on a stale account or a request
 * outside the current authenticated client's history. Server RLS/RPC are the
 * authority; this guard avoids sending stale or cross-account actions.
 */
export type ClientAction = "share" | "cancel";

export function ownedRequestForAction<T extends {
  id: string;
  client_id: string;
  technician_id: string | null;
  status: string;
}>(
  rows: readonly T[] | null | undefined,
  ownerId: string | null | undefined,
  requestId: string,
  action: ClientAction,
): T | null {
  if (!ownerId || !rows || !requestId) return null;
  return rows.find((row) =>
    row.id === requestId &&
    row.client_id === ownerId &&
    (action === "share"
      ? row.status === "aberta" && Boolean(row.technician_id)
      : row.status === "aberta" || row.status === "aceita"),
  ) ?? null;
}
