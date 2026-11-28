/** Server-only payment verification. A browser redirect is NEVER payment evidence. */
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAY_ID = /^[1-9][0-9]{0,19}$/;

export function safeMercadoPagoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    const host = url.hostname.toLowerCase();
    return (host === "mercadopago.com.br" || host.endsWith(".mercadopago.com.br") ||
      host === "mercadopago.com" || host.endsWith(".mercadopago.com")) ? url.toString() : null;
  } catch { return null; }
}

/** Match Mercado Pago's documented x-signature manifest, not the JSON body. */
export function verifyMercadoPagoWebhook(input: {
  signature: string | null; requestId: string | null; dataId: string | null;
  secret: string; now?: number;
}): boolean {
  const { signature, requestId, dataId, secret } = input;
  if (!signature || !requestId || !dataId || secret.length < 20 ||
    !PAY_ID.test(dataId) || !/^[A-Za-z0-9-]{8,100}$/.test(requestId)) return false;
  const fields = signature.split(",").map((part) => part.trim());
  if (fields.length !== 2) return false;
  const ts = fields.find((field) => field.startsWith("ts="))?.slice(3);
  const hex = fields.find((field) => field.startsWith("v1="))?.slice(3);
  if (!ts || !/^\d{10,13}$/.test(ts) || !hex || !/^[0-9a-f]{64}$/i.test(hex)) return false;
  const seconds = Number(ts.length === 13 ? Number(ts) / 1000 : ts);
  const now = input.now ?? Date.now();
  // Mercado Pago retries can be delayed; expire signatures after 24h.
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 24 * 60 * 60) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(hex, "hex"));
}

export type CheckedPayment = { paymentId: string; purchaseId: string; approvedAt: string };

/** All inputs must originate in a fresh GET /v1/payments/{id} by the server. */
export function checkedMercadoPagoPayment(payment: unknown, expected: {
  purchaseId: string; priceCents: number; collectorId: number; liveMode: boolean;
}): CheckedPayment | null {
  if (!payment || typeof payment !== "object" || !UUID.test(expected.purchaseId) ||
    !Number.isInteger(expected.priceCents) || expected.priceCents < 100 ||
    !Number.isSafeInteger(expected.collectorId) || expected.collectorId <= 0) return null;
  const p = payment as Record<string, unknown>;
  const id = String(p["id"] ?? "");
  if (!PAY_ID.test(id) || p["status"] !== "approved" || p["currency_id"] !== "BRL" ||
    p["external_reference"] !== `eut_contact_${expected.purchaseId}` ||
    p["collector_id"] !== expected.collectorId || p["live_mode"] !== expected.liveMode ||
    typeof p["transaction_amount"] !== "number" || !Number.isFinite(p["transaction_amount"]) ||
    Math.abs(p["transaction_amount"] * 100 - expected.priceCents) > 0.000001 ||
    p["refunded_amount"] !== 0 ||
    typeof p["date_approved"] !== "string" || !Number.isFinite(Date.parse(p["date_approved"]))) return null;
  return { paymentId: id, purchaseId: expected.purchaseId, approvedAt: p["date_approved"] };
}
