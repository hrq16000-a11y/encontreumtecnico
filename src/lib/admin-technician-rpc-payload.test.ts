import { describe, expect, it } from "vitest";
import { buildProposedTechnicianChangeArgs } from "./admin-technician-rpc-payload";
import type { PreparedEdit } from "./admin-technician-crud-intent";

const edit: PreparedEdit = {
  kind: "preview_only",
  technicianId: "10000000-0000-4000-8000-000000000001",
  expectedUpdatedAt: "2026-11-13T16:00:00.000Z",
  reason: "Revisão administrativa sintética",
  changes: {
    displayName: "Técnico QA",
    city: "Curitiba",
    uf: "PR",
    baseCityId: 4106902,
    coverageCityIds: [4106902, 4125506],
    radiusKm: 30,
    neighborhood: "Centro",
    categorySlugs: ["computadores"],
    serviceSlugs: ["manutencao-pc"],
    phone: { kind: "keep" },
  },
  auditPreview: {
    cityChanged: "pending_server_comparison",
    coverageCityCount: 2,
    serviceCount: 1,
    phoneChanged: false,
    phoneLast4: null,
    keepsExistingBlocks: true,
  },
};

describe("contrato offline da RPC de edição transacional", () => {
  it("preserva somente as chaves e tipos esperados pelo SQL proposto", () => {
    const args = buildProposedTechnicianChangeArgs(edit);
    expect(args).toEqual({
      _technician_id: edit.technicianId,
      _expected_updated_at: edit.expectedUpdatedAt,
      _reason: edit.reason,
      _payload: {
        display_name: "Técnico QA",
        base_city_ibge_id: 4106902,
        coverage_city_ids: [4106902, 4125506],
        radius_km: 30,
        neighborhood: "Centro",
        category_slugs: ["computadores"],
        service_slugs: ["manutencao-pc"],
        phone_action: "keep",
      },
    });
    expect(JSON.stringify(args)).not.toContain("phone_e164");
  });

  it("não inclui telefone na operação de remoção", () => {
    const args = buildProposedTechnicianChangeArgs({
      ...edit,
      changes: { ...edit.changes, phone: { kind: "remove" } },
    });
    expect(args._payload.phone_action).toBe("remove");
    expect(args._payload).not.toHaveProperty("phone_e164");
    expect(args._payload).not.toHaveProperty("allow_paid_contact");
  });

  it("só prepara contato completo para a operação explícita de substituição", () => {
    const args = buildProposedTechnicianChangeArgs({
      ...edit,
      changes: {
        ...edit.changes,
        phone: { kind: "replace", e164: "+5541999994444", allowPaidContact: false },
      },
    });
    expect(args._payload).toMatchObject({
      phone_action: "replace",
      phone_e164: "+5541999994444",
      allow_paid_contact: false,
    });
    expect(edit.auditPreview).not.toHaveProperty("phone_e164");
  });
});
