/** PR #344 adapter only: neither flag is enabled by default.
 * No server endpoints or official storage are activated by this file.
 */
export const HTTP_PRESENCE_INGEST_ENABLED = import.meta.env["VITE_EUT_HTTP_PRESENCE_INGEST"] === "enabled";
export const HTTP_PRESENCE_ADMIN_READ_ENABLED = import.meta.env["VITE_EUT_HTTP_PRESENCE_ADMIN_READ"] === "enabled";
export const HTTP_PRESENCE_READY = HTTP_PRESENCE_INGEST_ENABLED && HTTP_PRESENCE_ADMIN_READ_ENABLED;

export type LeaseOperation = "start" | "beat" | "leave";

export function newPresenceTabToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sendPresenceLease(op: LeaseOperation, tabToken: string, keepalive = false): Promise<number> {
  const body = op === "leave" ? { op, tabToken } : { op, tabToken, consent: true };
  const response = await fetch("/api/presence/leases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    cache: "no-store",
    keepalive,
    body: JSON.stringify(body),
  });
  return response.status;
}

export async function readAdminPresenceCount(accessToken: string): Promise<number> {
  if (!accessToken) throw new Error("Missing authenticated session");
  const response = await fetch("/api/admin/presence/count", {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Private count unavailable");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid aggregate");
  const value = result as Record<string, unknown>;
  if (typeof value.activeConsentedTabs !== "number" || !Number.isSafeInteger(value.activeConsentedTabs) || value.activeConsentedTabs < 0 ||
      typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt))) {
    throw new Error("Invalid aggregate");
  }
  return value.activeConsentedTabs;
}
