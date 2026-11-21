import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin-sections";
import { matchingAdminModules } from "@/lib/admin-global-search";

export const ADMIN_NAV_FAVORITES_KEY = "eut.admin.favorite-modules.v1";
export const ADMIN_NAV_RECENT_KEY = "eut.admin.recent-modules.v1";
export const ADMIN_NAV_COLLAPSED_KEY = "eut.admin.collapsed-groups.v1";

/** Presentation groups only: they neither add routes nor grant permissions. */
export const ADMIN_NAV_GROUPS = [
  { id: "geral", title: "Visão geral", keys: ["inicio"] },
  {
    id: "cadastros",
    title: "Cadastros e segurança",
    keys: ["usuarios", "tecnicos", "clientes", "contas", "contatos"],
  },
  { id: "atendimento", title: "Atendimento", keys: ["solicitacoes", "mensagens", "pagamentos"] },
  {
    id: "operacao",
    title: "Operação e conteúdo",
    keys: ["patrocinadores", "catalogo", "legado", "reivindicacoes", "metricas"],
  },
] as const satisfies ReadonlyArray<{ id: string; title: string; keys: readonly AdminSection[] }>;

const ALLOWED_KEYS = new Set<string>(ADMIN_SECTIONS.map((item) => item.key));

/** Never trust persisted browser values as route keys. */
export function sanitizeAdminFavorites(raw: unknown): AdminSection[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<AdminSection>();
  for (const item of raw) {
    if (typeof item === "string" && ALLOWED_KEYS.has(item)) unique.add(item as AdminSection);
  }
  return [...unique];
}

/** Store only known, collapsed group IDs; never persist administrative data. */
export function sanitizeAdminCollapsed(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const values = raw as Record<string, unknown>;
  const result: Record<string, boolean> = {};
  for (const group of ADMIN_NAV_GROUPS) {
    if (values[group.id] === true) result[group.id] = true;
  }
  return result;
}

/** The last four valid destinations, newest first, without duplicate links. */
export function nextAdminRecent(raw: unknown, active: AdminSection): AdminSection[] {
  return [active, ...sanitizeAdminFavorites(raw).filter((key) => key !== active)].slice(0, 4);
}

/** Reuse the exact accent-insensitive module matcher from global search. */
export function matchingAdminNavKeys(query: string): AdminSection[] {
  return matchingAdminModules(query).map((item) => item.section);
}
