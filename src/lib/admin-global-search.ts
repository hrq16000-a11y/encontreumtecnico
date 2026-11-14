import { ADMIN_SECTIONS, adminModulePath, type AdminSection } from "@/lib/admin-sections";

export type AdminSearchResult = {
  key: string;
  title: string;
  description: string;
  section: AdminSection;
  url: string;
};

/** Search terms are never interpolated into PostgREST filter expressions. */
export function cleanAdminSearch(raw: string): string {
  return raw
    .trim()
    .replace(/[\p{C}%_*,().]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

export function adminSearchUrl(section: AdminSection, search?: string, recordId?: string): string {
  const params = new URLSearchParams();
  if (search) params.set("busca", cleanAdminSearch(search));
  if (recordId && /^[a-zA-Z0-9_-]{1,80}$/.test(recordId)) params.set("registro", recordId);
  const suffix = params.toString();
  return adminModulePath(section) + (suffix ? `?${suffix}` : "");
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/** Every administration module remains reachable, even when a data source is unavailable. */
export function matchingAdminModules(raw: string): AdminSearchResult[] {
  const search = fold(cleanAdminSearch(raw));
  if (!search)
    return ADMIN_SECTIONS.map((module) => ({
      key: `module:${module.key}`,
      title: module.label,
      description: module.description,
      section: module.key,
      url: adminModulePath(module.key),
    }));
  return ADMIN_SECTIONS.filter((module) =>
    fold(`${module.label} ${module.description} ${module.key}`).includes(search),
  ).map((module) => ({
    key: `module:${module.key}`,
    title: module.label,
    description: module.description,
    section: module.key,
    url: adminModulePath(module.key),
  }));
}
