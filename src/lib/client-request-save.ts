/**
 * A request INSERT and an optional, individually consented SHARE are two
 * different operations. An exception may mean the response was lost after the
 * backend committed: never claim a rollback or automatically retry the write.
 */
export type ClientRequestSaveResult =
  | "stored_private"
  | "shared"
  | "share_unconfirmed"
  | "save_rejected"
  | "save_unconfirmed";

type InsertResponse = { error: unknown | null };
type ShareResponse = { error: unknown | null; data?: { status?: string } | null };

export async function persistClientRequest(
  insert: () => Promise<InsertResponse>,
  share?: () => Promise<ShareResponse>,
): Promise<ClientRequestSaveResult> {
  try {
    const result = await insert();
    if (result.error) return "save_rejected";
  } catch {
    return "save_unconfirmed";
  }
  if (!share) return "stored_private";
  try {
    const result = await share();
    return !result.error && result.data?.status === "enviado"
      ? "shared" : "share_unconfirmed";
  } catch {
    return "share_unconfirmed";
  }
}
