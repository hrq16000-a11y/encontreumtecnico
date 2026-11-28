/** Explicit declarations only; never infer availability from transport or equipment. */
export const SERVICE_MODALITIES = [
  { code: "onsite", label: "Visita presencial" },
  { code: "bench", label: "Atendimento em bancada" },
  { code: "pickup_delivery", label: "Retirada e entrega" },
  { code: "remote", label: "Suporte remoto" },
  { code: "hybrid", label: "Atendimento híbrido" },
] as const;

export type ServiceModality = typeof SERVICE_MODALITIES[number]["code"];

export function declaredServiceModalities(input: unknown): ServiceModality[] {
  if (!Array.isArray(input)) return [];
  return SERVICE_MODALITIES.filter(({ code }) => input.includes(code)).map(({ code }) => code);
}

export function serviceModalityMatch(input: unknown, requested: ServiceModality): "declared" | "not_declared" | "unknown" {
  const declared = declaredServiceModalities(input);
  if (!declared.length) return "unknown";
  return declared.includes(requested) ? "declared" : "not_declared";
}
