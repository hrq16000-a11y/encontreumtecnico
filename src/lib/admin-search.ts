import type { AdminModule } from "@/lib/admin-sections";

/** Search text is limited before entering PostgREST filter expressions. */
export function cleanAdminQuery(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ").trim().slice(0, 70);
}

export function adminResultHref(module: AdminModule, filter: string): string {
  return `/admin/${module}?q=${encodeURIComponent(filter)}`;
}
