export type AdminTechnicianAction =
  | "editar" | "aprovar" | "suspender" | "reativar" | "rejeitar" | "revisar";

type TechnicianActionResult = { id: string; status: string; name: string };

const STATUS_AFTER_ACTION: Record<Exclude<AdminTechnicianAction, "editar">, string> = {
  aprovar: "aprovado",
  suspender: "suspenso",
  reativar: "aprovado",
  rejeitar: "rejeitado",
  revisar: "pendente",
};

/** The audited RPC returns the updated row. An ID alone is not proof of the requested transition. */
export function confirmedAdminTechnicianAction(
  value: unknown,
  technicianId: string,
  action: AdminTechnicianAction,
  previousStatus: string,
  expectedName: string,
): value is TechnicianActionResult {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row["id"] !== technicianId || typeof row["name"] !== "string" || !row["name"])
    return false;
  if (action === "editar")
    return row["status"] === previousStatus && row["name"] === expectedName.trim();
  return row["status"] === STATUS_AFTER_ACTION[action];
}
