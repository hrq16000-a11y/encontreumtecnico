import { describe, expect, it } from "vitest";
import { brlToCents, centsToBrl, EMPTY_OPERATIONS, sameTechnicianOperations,
  hasDeclaredTechnicianOperations, reconcileTechnicianOperationsCoverage, technicianOperationsSchema, validateTechnicianOperations } from "./technician-operations-contract";

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
  it("recupera condições editáveis após retirar cidade da cobertura, sem gravação implícita", () => {
    const stored = {
      ...EMPTY_OPERATIONS, equipment: ["notebook" as const], transport_mode: "car" as const,
      service_windows: ["overnight" as const], eta_outside_minutes: 45,
      free_city_ids: [4106902], paid_city_ids: [4125506],
      free_km: 10, km_threshold: 50, km_rate_cents: 250, km_rate_after_cents: 350,
    };
    const before = JSON.stringify(stored);
    expect(validateTechnicianOperations(stored, [4106902])).toBeNull();
    const reconciled = reconcileTechnicianOperationsCoverage(stored, [4106902]);
    expect(reconciled).toEqual({ draft: { ...stored, paid_city_ids: [] }, removedCityIds: [4125506] });
    expect(validateTechnicianOperations(reconciled?.draft, [4106902])).toEqual(reconciled?.draft);
    expect(JSON.stringify(stored)).toBe(before);
    expect(reconcileTechnicianOperationsCoverage(stored, [4106902, 4125506]))
      .toEqual({ draft: stored, removedCityIds: [] });
  });
  it("não recupera documentos, propriedades extras ou opções inválidas", () => {
    expect(reconcileTechnicianOperationsCoverage({ ...EMPTY_OPERATIONS, phone: "privado" }, [])).toBeNull();
    expect(reconcileTechnicianOperationsCoverage({ ...EMPTY_OPERATIONS, equipment: ["documento"] }, [])).toBeNull();
    expect(reconcileTechnicianOperationsCoverage({
      ...EMPTY_OPERATIONS, free_city_ids: [4106902], paid_city_ids: [4106902],
    }, [4106902])).toBeNull();
  });
  it("mostra condições públicas só quando algo foi declarado, inclusive zero km", () => {
    expect(hasDeclaredTechnicianOperations(EMPTY_OPERATIONS)).toBe(false);
    expect(hasDeclaredTechnicianOperations({ ...EMPTY_OPERATIONS, km_rate_cents: 0 })).toBe(true);
    expect(hasDeclaredTechnicianOperations({ ...EMPTY_OPERATIONS, transport_mode: "bicycle" })).toBe(true);
  });
  it("não converte valores decimais em floats e não altera taxa da plataforma", () => {
    expect(brlToCents("12,50")).toBe(1250);
    expect(brlToCents("0,05")).toBe(5);
    expect(centsToBrl(1250)).toBe("12,50");
    expect(brlToCents("1.250,00")).toBeNaN();
    expect(brlToCents("999,99")).toBeNaN();
  });
});
