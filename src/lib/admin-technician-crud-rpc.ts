import type { PreparedEdit } from "./admin-technician-crud-intent";

export type AdminArchiveAction = "archive" | "restore";

export type AdminArchiveRequest = {
  technicianId: string;
  expectedUpdatedAt: string;
  action: AdminArchiveAction;
  reason: string;
};

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

export function technicianArchiveRpcArgs(request: AdminArchiveRequest): Record<string, unknown> {
  return {
    _technician_id: request.technicianId,
    _expected_updated_at: request.expectedUpdatedAt,
    _action: request.action,
    _reason: request.reason.trim(),
  };
}

/** Archive and restore never delete an account, a private number or audit history. */
export async function persistAdminTechnicianArchive(
  rpc: AdminCrudRpc,
  request: AdminArchiveRequest,
): Promise<AdminSaveResult> {
  try {
    const { data, error } = await rpc(
      "eut_admin_technician_archive",
      technicianArchiveRpcArgs(request),
    );
    if (error) {
      if (error.code === "40001") return { ok: false, reason: "conflict" };
      if (error.code === "42501") return { ok: false, reason: "denied" };
      return { ok: false, reason: "unavailable" };
    }
    const result = data as Record<string, unknown> | null;
    const shouldBeArchived = request.action === "archive";
    if (result?.["ok"] !== true || result["technician_id"] !== request.technicianId ||
        result["archived"] !== shouldBeArchived || result["contact_enabled"] !== false ||
        result["status"] !== (shouldBeArchived ? "suspenso" : "pendente") ||
        typeof result["updated_at"] !== "string" ||
        !Number.isFinite(Date.parse(result["updated_at"]))) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true, updatedAt: result["updated_at"] };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
