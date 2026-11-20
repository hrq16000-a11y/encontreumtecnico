import { z } from "zod";

/** Controlled vocabulary only: no user-entered phone, plate, address or document. */
export const EQUIPMENT = [
  { code: "notebook", label: "Notebook para diagnóstico" },
  { code: "tools", label: "Kit de ferramentas" },
  { code: "multimeter", label: "Multímetro" },
  { code: "cable_tester", label: "Testador de cabos" },
  { code: "mobile_internet", label: "Internet móvel de apoio" },
  { code: "ladder", label: "Escada" },
  { code: "drill", label: "Furadeira" },
  { code: "safety_gear", label: "Equipamentos de proteção" },
] as const;
export const TRANSPORT = [
  { code: "car", label: "Carro" },
  { code: "motorcycle", label: "Moto" },
  { code: "public_transport", label: "Transporte público" },
  { code: "bicycle", label: "Bicicleta" },
  { code: "on_foot", label: "A pé" },
  { code: "other", label: "Outro meio" },
] as const;
export const WINDOWS = [
  { code: "business", label: "Horário comercial" },
  { code: "evening", label: "Noite" },
  { code: "overnight", label: "Madrugada" },
  { code: "weekend", label: "Finais de semana" },
  { code: "holiday", label: "Feriados" },
] as const;

const EquipmentCode = z.enum(EQUIPMENT.map(item => item.code) as [typeof EQUIPMENT[number]["code"], ...typeof EQUIPMENT[number]["code"][]]);
const TransportCode = z.enum(TRANSPORT.map(item => item.code) as [typeof TRANSPORT[number]["code"], ...typeof TRANSPORT[number]["code"][]]);
const WindowCode = z.enum(WINDOWS.map(item => item.code) as [typeof WINDOWS[number]["code"], ...typeof WINDOWS[number]["code"][]]);
const cities = z.array(z.number().int().min(1000000).max(9999999)).max(5);
const cents = z.number().int().min(0).max(50000).nullable();

export const technicianOperationsSchema = z.object({
  equipment: z.array(EquipmentCode).max(8),
  transport_mode: TransportCode.nullable(),
  can_travel: z.boolean(),
  service_windows: z.array(WindowCode).max(5),
  eta_business_minutes: z.number().int().min(15).max(1440).nullable(),
  eta_outside_minutes: z.number().int().min(15).max(1440).nullable(),
  free_city_ids: cities,
  paid_city_ids: cities,
  free_km: z.number().int().min(0).max(2000).nullable(),
  km_threshold: z.number().int().min(0).max(2000).nullable(),
  km_rate_cents: cents,
  km_rate_after_cents: cents,
}).strict().superRefine((value, ctx) => {
  for (const key of ["equipment", "service_windows", "free_city_ids", "paid_city_ids"] as const) {
    if (new Set<string | number>(value[key]).size !== value[key].length) ctx.addIssue({ code: "custom", path: [key], message: "Não repita opções." });
  }
  if (value.free_city_ids.some(id => value.paid_city_ids.includes(id)))
    ctx.addIssue({ code: "custom", path: ["paid_city_ids"], message: "Uma cidade não pode ter taxa e gratuidade simultaneamente." });
  if (value.km_rate_after_cents !== null && (value.km_rate_cents === null || value.km_threshold === null))
    ctx.addIssue({ code: "custom", path: ["km_rate_after_cents"], message: "Informe o valor inicial e o limite para usar a segunda faixa." });
});

export type TechnicianOperations = z.infer<typeof technicianOperationsSchema>;
export const EMPTY_OPERATIONS: TechnicianOperations = {
  equipment: [], transport_mode: null, can_travel: false, service_windows: [],
  eta_business_minutes: null, eta_outside_minutes: null,
  free_city_ids: [], paid_city_ids: [], free_km: null, km_threshold: null,
  km_rate_cents: null, km_rate_after_cents: null,
};

export function validateTechnicianOperations(input: unknown, coverageCityIds: readonly number[]): TechnicianOperations | null {
  const parsed = technicianOperationsSchema.safeParse(input);
  if (!parsed.success) return null;
  if ([...parsed.data.free_city_ids, ...parsed.data.paid_city_ids].some(id => !coverageCityIds.includes(id))) return null;
  return parsed.data;
}

export function sameTechnicianOperations(a: TechnicianOperations, b: unknown): boolean {
  const parsed = technicianOperationsSchema.safeParse(b);
  if (!parsed.success) return false;
  const normalize = (value: TechnicianOperations) => ({ ...value,
    equipment: [...value.equipment].sort(), service_windows: [...value.service_windows].sort(),
    free_city_ids: [...value.free_city_ids].sort(), paid_city_ids: [...value.paid_city_ids].sort(),
  });
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(parsed.data));
}

/** BRL is transported as integer cents; never use floats for rates. */
export function brlToCents(text: string): number | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (!/^\d{1,3}(?:,\d{1,2})?$/.test(normalized)) return Number.NaN;
  const [whole, fraction = ""] = normalized.split(",");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return result <= 50000 ? result : Number.NaN;
}
export function centsToBrl(value: number | null): string {
  return value === null ? "" : `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}
