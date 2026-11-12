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
  const sponsors = adminCount(totals["sponsors"]);
  const campaigns = adminCount(totals["campaigns"]);
  const returnedCampaigns = data["campaigns"] as unknown[];
  // The existing admin RPC returns at most 100 campaign rows, even when totals
  // contain more. Never label a partial list's draft count as the exact total.
  const isComplete = campaigns !== null && returnedCampaigns.length === campaigns &&
    returnedCampaigns.every((campaign) => typeof record(campaign)?.["status"] === "string");
  return {
    sponsors,
    campaigns,
    drafts: isComplete
      ? returnedCampaigns.filter((campaign) => record(campaign)?.["status"] === "draft").length
      : null,
  };
}
