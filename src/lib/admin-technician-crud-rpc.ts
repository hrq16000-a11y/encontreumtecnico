import type { PreparedEdit } from "./admin-technician-crud-intent";

type RpcReply = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

export type AdminCrudRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<RpcReply>;

export type AdminSaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; reason: "conflict" | "denied" | "unavailable" };

/**
 * Only the dedicated server RPC may persist these fields. Its role checks, lock,
 * audit insert and private-contact mutation must succeed in one transaction.
 */
export function technicianEditRpcArgs(prepared: PreparedEdit): Record<string, unknown> {
  const phone = prepared.changes.phone;
  return {
    _technician_id: prepared.technicianId,
    _expected_updated_at: prepared.expectedUpdatedAt,
    _reason: prepared.reason,
    _payload: {
      base_city_ibge_id: prepared.changes.baseCityId,
      coverage_city_ids: prepared.changes.coverageCityIds,
      radius_km: prepared.changes.radiusKm,
      neighborhood: prepared.changes.neighborhood,
      category_slugs: prepared.changes.categorySlugs,
      service_slugs: prepared.changes.serviceSlugs,
      phone_action: phone.kind,
      ...(phone.kind === "replace"
        ? { phone_e164: phone.e164, allow_paid_contact: false }
        : {}),
    },
  };
}

export async function persistAdminTechnicianEdit(
  rpc: AdminCrudRpc,
  prepared: PreparedEdit,
): Promise<AdminSaveResult> {
  try {
    const { data, error } = await rpc(
      "eut_admin_technician_change",
      technicianEditRpcArgs(prepared),
    );
    // Do not pass raw server error details to the UI: they may contain PII.
    if (error) {
      if (error.code === "40001") return { ok: false, reason: "conflict" };
      if (error.code === "42501") return { ok: false, reason: "denied" };
      return { ok: false, reason: "unavailable" };
    }
    const result = data as Record<string, unknown> | null;
    if (result?.["ok"] !== true || result["technician_id"] !== prepared.technicianId ||
        typeof result["updated_at"] !== "string" || !Number.isFinite(Date.parse(result["updated_at"]))) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, updatedAt: result["updated_at"] };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
