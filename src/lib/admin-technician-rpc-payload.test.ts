import { describe, expect, it } from "vitest";
import { adminTechnicianChangePayload, unchangedSinceValidatedPreview } from "./admin-technician-rpc-payload";
import type { PreparedEdit } from "./admin-technician-crud-intent";

const base: PreparedEdit = {
  kind: "preview_only",
  technicianId: "10000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-11-14T00:00:00Z",
  reason: "Correção auditada do cadastro",
  changes: {
    city: "Curitiba", uf: "PR", baseCityId: 4106902,
    coverageCityIds: [4106902], radiusKm: 20, neighborhood: null,
    categorySlugs: ["computadores"], serviceSlugs: ["manutencao-pc"],
    phone: { kind: "keep" },
  },
  auditPreview: {
    cityChanged: "pending_server_comparison", coverageCityCount: 1,
    serviceCount: 1, phoneChanged: false, phoneLast4: null,
    keepsExistingBlocks: true,
  },
};

describe("payload transacional do CRUD administrativo", () => {
  it("envia IBGE, categorias e serviços sem publicar campos privados", () => {
    expect(adminTechnicianChangePayload(base)).toEqual({
      base_city_ibge_id: 4106902,
      coverage_city_ids: [4106902], radius_km: 20, neighborhood: null,
      category_slugs: ["computadores"], service_slugs: ["manutencao-pc"],
      phone_action: "keep",
    });
  });
  it("substituição privada força divulgação desativada", () => {
    const edit: PreparedEdit = {
      ...base,
      changes: {
        ...base.changes,
        phone: { kind: "replace", e164: "+5541999990001", allowPaidContact: true },
      },
    };
    expect(adminTechnicianChangePayload(edit)).toMatchObject({
      phone_action: "replace", phone_e164: "+5541999990001",
      allow_paid_contact: false,
    });
  });
  it("remoção do contato não envia número anterior nem permissões", () => {
    const edit: PreparedEdit = { ...base, changes: { ...base.changes, phone: { kind: "remove" } } };
    const serialized = JSON.stringify(adminTechnicianChangePayload(edit));
    expect(serialized).not.toContain("phone_e164");
    expect(serialized).not.toContain("allow_paid_contact");
    expect(serialized).toContain('"phone_action":"remove"');
  });
  it("impede gravar uma prévia antiga após editar cidade, categorias, motivo ou telefone", () => {
    expect(unchangedSinceValidatedPreview(base, { ...base })).toBe(true);
    for (const changed of [
      { ...base, reason: "Correção alterada" },
      { ...base, changes: { ...base.changes, baseCityId: 4125506 } },
      { ...base, changes: { ...base.changes, categorySlugs: ["redes"] } },
      { ...base, changes: { ...base.changes, phone: { kind: "remove" as const } } },
      { ...base, expectedUpdatedAt: "2026-11-14T00:00:01Z" },
    ]) {
      expect(unchangedSinceValidatedPreview(base, changed)).toBe(false);
    }
  });
});
