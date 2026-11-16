type ArchiveAction = "archive" | "restore";

type ArchiveResult = {
  ok?: unknown;
  technician_id?: unknown;
  archived?: unknown;
  admin_active?: unknown;
};

/** Confirm the RPC state without assuming that restoration always disables the technician. */
export function confirmedTechnicianArchiveResult(
  result: ArchiveResult | null | undefined,
  technicianId: string,
  action: ArchiveAction,
): boolean {
  return result?.ok === true &&
    result.technician_id === technicianId &&
    result.archived === (action === "archive") &&
    (action === "archive" ? result.admin_active === false : typeof result.admin_active === "boolean");
}
