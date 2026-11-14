import { describe, expect, it, vi } from "vitest";
import type { PreparedEdit } from "./admin-technician-crud-intent";
import { persistAdminTechnicianArchive, persistAdminTechnicianEdit, technicianArchiveRpcArgs, technicianEditRpcArgs } from "./admin-technician-crud-rpc";

const input: PreparedEdit = {
  kind: "preview_only",
  technicianId: "bed12daa-2345-4fd1-a123-1245d90bf33a",
  expectedUpdatedAt: "2026-11-13T12:00:00.000Z",
  reason: "Ajuste territorial solicitado pela administração",
  changes: {
    city: "Curitiba", uf: "PR", baseCityId: 4106902,
    coverageCityIds: [4106902], radiusKm: 20, neighborhood: "Centro",
    categorySlugs: ["informatica"], serviceSlugs: [],
    phone: { kind: "keep" },
  },
  auditPreview: {
    cityChanged: "pending_server_comparison", coverageCityCount: 1,
    serviceCount: 0, phoneChanged: false, phoneLast4: null,
    keepsExistingBlocks: true,
  },
};

describe("RPC administrativo de técnicos", () => {
  it("mapeia apenas os campos aceitos pelo contrato; nunca ativa contato pago", () => {
    const args = technicianEditRpcArgs({ ...input, changes: {
      ...input.changes, phone: { kind: "replace", e164: "+5541999999999", allowPaidContact: true },
    } });
    expect(args["_technician_id"]).toBe(input.technicianId);
    expect(args["_expected_updated_at"]).toBe(input.expectedUpdatedAt);
    expect(args["_payload"]).toEqual({
      base_city_ibge_id: 4106902, coverage_city_ids: [4106902], radius_km: 20,
      neighborhood: "Centro", category_slugs: ["informatica"], service_slugs: [],
      phone_action: "replace", phone_e164: "+5541999999999", allow_paid_contact: false,
    });
    expect(technicianEditRpcArgs(input)["_payload"]).not.toHaveProperty("phone_e164");
  });

  it("não considera sucesso sem confirmação explícita, ID e versão", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      ok: true, technician_id: input.technicianId, updated_at: "2026-11-14T00:20:00Z",
    }, error: null });
    await expect(persistAdminTechnicianEdit(rpc, input)).resolves.toEqual({
      ok: true, updatedAt: "2026-11-14T00:20:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("eut_admin_technician_change", technicianEditRpcArgs(input));
    rpc.mockResolvedValueOnce({ data: { ok: true, updated_at: "2026-11-14T00:20:00Z" }, error: null });
    await expect(persistAdminTechnicianEdit(rpc, input)).resolves.toEqual({
      ok: false, reason: "unavailable",
    });
  });

  it("não repassa telefones nem mensagens privadas de erro ao navegador", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null,
      error: { code: "42501", message: "telefone privado +5541999999999" } });
    const result = await persistAdminTechnicianEdit(rpc, input);
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(JSON.stringify(result)).not.toContain("+5541");
    rpc.mockRejectedValueOnce(new Error("+5541999999999"));
    await expect(persistAdminTechnicianEdit(rpc, input)).resolves.toEqual({
      ok: false, reason: "unavailable",
    });
  });

  it("trata concorrência como motivo para recarregar", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "40001" } });
    await expect(persistAdminTechnicianEdit(rpc, input)).resolves.toEqual({
      ok: false, reason: "conflict",
    });
  });
});

describe("arquivamento reversível auditado", () => {
  const archive = {
    technicianId: input.technicianId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    reason: "Arquivamento solicitado pela administração",
    action: "archive" as const,
  };

  it("envia somente ID, versão, operação e motivo; não inclui contatos privados", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      ok: true, technician_id: archive.technicianId,
      archived: true, status: "suspenso", contact_enabled: false,
      updated_at: "2026-11-14T02:20:00Z",
    }, error: null });
    await expect(persistAdminTechnicianArchive(rpc, archive)).resolves.toEqual({
      ok: true, updatedAt: "2026-11-14T02:20:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("eut_admin_technician_archive", technicianArchiveRpcArgs(archive));
    expect(JSON.stringify(technicianArchiveRpcArgs(archive))).not.toContain("phone");
  });

  it("restaura apenas para pendente e sem contato habilitado", async () => {
    const request = { ...archive, action: "restore" as const };
    const rpc = vi.fn().mockResolvedValue({ data: {
      ok: true, technician_id: archive.technicianId,
      archived: false, status: "pendente", contact_enabled: false,
      updated_at: "2026-11-14T02:21:00Z",
    }, error: null });
    await expect(persistAdminTechnicianArchive(rpc, request)).resolves.toMatchObject({ ok: true });
    rpc.mockResolvedValueOnce({ data: {
      ok: true, technician_id: archive.technicianId,
      archived: false, status: "aprovado", contact_enabled: true,
      updated_at: "2026-11-14T02:21:00Z",
    }, error: null });
    await expect(persistAdminTechnicianArchive(rpc, request)).resolves.toEqual({
      ok: false, reason: "unavailable",
    });
  });

  it("trata conflitos e negações sem expor respostas privadas", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null,
      error: { code: "40001", message: "contato privado +5541999999999" } });
    const result = await persistAdminTechnicianArchive(rpc, archive);
    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(JSON.stringify(result)).not.toContain("+5541");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(persistAdminTechnicianArchive(rpc, archive)).resolves.toEqual({
      ok: false, reason: "denied",
    });
  });
});
