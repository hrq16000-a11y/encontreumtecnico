/** Parse Supabase OAuth errors from both query and hash without touching tokens or unrelated state. */
const ERROR_KEYS = ["error", "error_code", "error_description"] as const;

export function hasOAuthCallbackError(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return query.has("error") || query.has("error_code") ||
    fragment.has("error") || fragment.has("error_code");
}

export function clearOAuthErrorParams(location: Pick<Location, "pathname" | "search" | "hash">): string {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  for (const key of ERROR_KEYS) {
    query.delete(key);
    fragment.delete(key);
  }
  const q = query.toString();
  const h = fragment.toString();
  return location.pathname + (q ? "?" + q : "") + (h ? "#" + h : "");
}
