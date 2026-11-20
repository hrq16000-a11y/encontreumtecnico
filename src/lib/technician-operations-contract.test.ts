import { describe, expect, it } from "vitest";
import { brlToCents, centsToBrl, EMPTY_OPERATIONS, sameTechnicianOperations,
  technicianOperationsSchema, validateTechnicianOperations } from "./technician-operations-contract";

describe("contrato operacional tipado", () => {
  it("aceita dados profissionais controlados e sem dados pessoais", () => {
    const valid = { ...EMPTY_OPERATIONS, equipment: ["notebook", "mobile_internet"],
      transport_mode: "car", can_travel: true, service_windows: ["business", "overnight"],
      eta_business_minutes: 90, free_city_ids: [4106902], paid_city_ids: [4125506],
      free_km: 10, km_threshold: 50, km_rate_cents: 250, km_rate_after_cents: 350 };
    expect(validateTechnicianOperations(valid, [4106902, 4125506])).toEqual(valid);
    const parsed = technicianOperationsSchema.parse(valid);
    expect(sameTechnicianOperations(parsed, { ...valid, equipment: ["mobile_internet", "notebook"] })).toBe(true);
  });
  it("rejeita endereço/documentos extras, nomes livres, cidades estranhas e duplicadas", () => {
    expect(technicianOperationsSchema.safeParse({ ...EMPTY_OPERATIONS, phone: "private" }).success).toBe(false);
    expect(technicianOperationsSchema.safeParse({ ...EMPTY_OPERATIONS, equipment: ["notebook", "CNH"] }).success).toBe(false);
    expect(validateTechnicianOperations({ ...EMPTY_OPERATIONS, free_city_ids: [4106902] }, [4125506])).toBeNull();
    expect(validateTechnicianOperations({ ...EMPTY_OPERATIONS, free_city_ids: [4106902], paid_city_ids: [4106902] }, [4106902])).toBeNull();
  });
  it("não converte valores decimais em floats e não altera taxa da plataforma", () => {
    expect(brlToCents("12,50")).toBe(1250);
    expect(brlToCents("0,05")).toBe(5);
    expect(centsToBrl(1250)).toBe("12,50");
    expect(brlToCents("1.250,00")).toBeNaN();
    expect(brlToCents("999,99")).toBeNaN();
  });
});
