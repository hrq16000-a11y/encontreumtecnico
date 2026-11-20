/** Commercial configuration only. Never store Mercado Pago credentials here. */
export type MercadoPagoSettings = {
  enabled: boolean;
  regular_price_cents: number;
  outside_price_cents: number;
  regular_from: string;
  regular_until: string;
  daily_contact_limit: 1 | 2;
  version: number;
  updated_at: string | null;
};

const HOURS = /^([01]\d|2[0-3]):[0-5]\d$/;
const CENTS_MIN = 100;
const CENTS_MAX = 99900;

export function validateMercadoPagoSettings(value: unknown): MercadoPagoSettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Configuração financeira indisponível.");
  const v = value as Record<string, unknown>;
  if (typeof v["enabled"] !== "boolean" ||
    !Number.isInteger(v["regular_price_cents"]) ||
    !Number.isInteger(v["outside_price_cents"]) ||
    (v["regular_price_cents"] as number) < CENTS_MIN ||
    (v["outside_price_cents"] as number) < CENTS_MIN ||
    (v["regular_price_cents"] as number) > CENTS_MAX ||
    (v["outside_price_cents"] as number) > CENTS_MAX ||
    typeof v["regular_from"] !== "string" || !HOURS.test(v["regular_from"]) ||
    typeof v["regular_until"] !== "string" || !HOURS.test(v["regular_until"]) ||
    v["regular_from"] >= v["regular_until"] ||
    (v["daily_contact_limit"] !== 1 && v["daily_contact_limit"] !== 2) ||
    !Number.isSafeInteger(v["version"]) || (v["version"] as number) < 1 ||
    (v["updated_at"] !== null && typeof v["updated_at"] !== "string"))
    throw new Error("Configuração financeira inválida.");
  return v as MercadoPagoSettings;
}

export function parseBrlToCents(value: string): number | null {
  // Only standard decimal digits and comma/dot; no scientific notation or truncation.
  if (!/^\d{1,3}(?:[,.]\d{1,2})?$/.test(value.trim())) return null;
  const [reais, centavos = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
  return cents >= CENTS_MIN && cents <= CENTS_MAX ? cents : null;
}

export function centsToBrl(value: number): string {
  return (value / 100).toFixed(2).replace(".", ",");
}

export function quoteMercadoPagoAccess(settings: MercadoPagoSettings, at: Date): number {
  const valid = validateMercadoPagoSettings(settings);
  if (!Number.isFinite(at.getTime())) throw new Error("Data inválida.");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = formatter.formatToParts(at);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  if (!hour || !minute) throw new Error("Horário indisponível.");
  const local = `${hour}:${minute}`;
  return local >= valid.regular_from && local < valid.regular_until
    ? valid.regular_price_cents : valid.outside_price_cents;
}
