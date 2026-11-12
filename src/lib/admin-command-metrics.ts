/** Numeric-only contract for the administrative overview. Never retain private RPC payloads. */
export function adminCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
export function clientCounters(value: unknown) {
  const data = record(value);
  return {
    clients: adminCount(data?.["clients_total"]),
    unconfirmed: adminCount(data?.["clients_unconfirmed"]),
  };
}
export function advertisingCounters(value: unknown) {
  const data = record(value);
  const totals = record(data?.["totals"]);
  if (!totals || !Array.isArray(data?.["campaigns"]) || !Array.isArray(data?.["sponsors"])) {
    return { sponsors: null, campaigns: null, drafts: null };
  }
  return {
    sponsors: adminCount(totals["sponsors"]),
    campaigns: adminCount(totals["campaigns"]),
    drafts: data["campaigns"].filter((campaign: unknown) => record(campaign)?.["status"] === "draft").length,
  };
}
