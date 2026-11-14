import type { AdminModule } from "@/lib/admin-sections";

/** Search text is limited before entering PostgREST filter expressions. */
export function cleanAdminQuery(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ").trim().slice(0, 70);
}

export function adminResultHref(module: AdminModule, filter: string): string {
  return `/admin/${module}?q=${encodeURIComponent(filter)}`;
}

/** Leaving a focused result must also clear the deep link, including on refresh. */
export function clearAdminFocusedRecordQuery(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("registro")) return;
  url.searchParams.delete("registro");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
