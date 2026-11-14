export type TechnicianViewMode = "rows" | "cards" | "avatars";
export type TechnicianSortMode = "name-asc" | "name-desc" | "newest" | "updated";
export type TechnicianStateFilter = "all" | "active" | "inactive" | "review";
export type TechnicianBulkAction = "import" | "archive" | "restore";

export type DirectoryActionRow = {
  key: string;
  name: string;
  origin: "portal" | "wordpress" | "guiafix" | "manual" | "other_import";
  portalId?: string | undefined;
  portalStatus?: "pendente" | "aprovado" | "suspenso" | "rejeitado" | undefined;
  wpPostId?: number | undefined;
  recordState?: string | undefined;
  demo?: boolean | undefined;
  registry?: { archived: boolean; admin_active: boolean } | undefined;
  createdAt?: string | undefined;
  importedAt?: string | undefined;
  updatedAt?: string | undefined;
};

export function technicianState(row: DirectoryActionRow): Exclude<TechnicianStateFilter, "all"> {
  if (row.registry)
    return row.registry.archived ? "inactive" : row.registry.admin_active ? "active" : "review";
  if (row.portalStatus === "aprovado") return "active";
  if (
    row.portalStatus === "suspenso" ||
    row.portalStatus === "rejeitado" ||
    row.recordState === "excluido"
  )
    return "inactive";
  return "review";
}

/** Never offer a bulk mutation the server cannot perform for this row. */
export function canBulkAct(row: DirectoryActionRow, action: TechnicianBulkAction): boolean {
  if (row.demo) return false;
  if (action === "import")
    return (
      !row.registry &&
      (row.origin === "guiafix" || (row.origin === "wordpress" && row.wpPostId !== undefined))
    );
  if (row.registry) return action === "archive" ? !row.registry.archived : row.registry.archived;
  if (row.portalId)
    return action === "archive" ? row.portalStatus === "aprovado" : row.portalStatus === "suspenso";
  if (row.wpPostId !== undefined)
    return action === "archive" ? row.recordState !== "excluido" : row.recordState === "excluido";
  return false;
}

export function orderTechnicians<T extends DirectoryActionRow>(
  rows: readonly T[],
  sort: TechnicianSortMode,
): T[] {
  return [...rows].sort((a, b) => {
    if (sort === "newest" || sort === "updated") {
      const getDate = (row: T) =>
        Date.parse((sort === "updated" ? row.updatedAt || row.createdAt || row.importedAt : row.createdAt || row.importedAt) || "") ||
        0;
      const delta = getDate(b) - getDate(a);
      if (delta) return delta;
    }
    const names = a.name.localeCompare(b.name, "pt-BR");
    return (sort === "name-desc" ? -names : names) || a.key.localeCompare(b.key);
  });
}
