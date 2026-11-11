/**
 * Tabela de cotação, sem chamadas financeiras nem acesso a dados privados.
 * O fuso deve vir da localização do atendimento VALIDADA no servidor;
 * nunca confiar no fuso ou no preço enviado pelo navegador.
 */
export const BRAZIL_PAYMENT_TIME_ZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Maceio",
  "America/Araguaina",
  "America/Santarem",
  "America/Noronha",
] as const;

export type BrazilPaymentTimeZone = (typeof BRAZIL_PAYMENT_TIME_ZONES)[number];

export type ContactAccessQuote = {
  amountCents: 999 | 2999;
  amountBRL: "9.99" | "29.99";
  period: "regular" | "after_hours";
  timeZone: BrazilPaymentTimeZone;
  pricedAt: string;
  priceRule: "contact-access-v1";
};

/** 09:00 inclusivo até 18:00 exclusivo no fuso do atendimento. */
export function quoteContactAccess(
  at: Date,
  timeZone: BrazilPaymentTimeZone,
): ContactAccessQuote {
  if (!Number.isFinite(at.getTime())) throw new Error("Data de cotação inválida.");
  if (!(BRAZIL_PAYMENT_TIME_ZONES as readonly string[]).includes(timeZone))
    throw new Error("Fuso de atendimento não permitido.");

  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at).find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart);
  if (!hourPart || !Number.isInteger(hour) || hour < 0 || hour > 23)
    throw new Error("Não foi possível calcular o horário local.");

  const regular = hour >= 9 && hour < 18;
  return {
    amountCents: regular ? 999 : 2999,
    amountBRL: regular ? "9.99" : "29.99",
    period: regular ? "regular" : "after_hours",
    timeZone,
    pricedAt: at.toISOString(),
    priceRule: "contact-access-v1",
  };
}
