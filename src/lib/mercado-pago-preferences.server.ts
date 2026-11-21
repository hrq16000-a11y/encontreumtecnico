/**
 * Mercado Pago Checkout Pro (Preferences API) transport. No public endpoint,
 * database write or contact release is included; call only after an authorized
 * purchase intent and a transactionally reserved idempotency claim exist.
 */
import { safeMercadoPagoUrl } from "./mercado-pago-security.server";

const API = "https://api.mercadopago.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function credentials(requireCheckout = false) {
  const mode = process.env["MP_CHECKOUT_MODE"];
  if ((mode !== "sandbox" && mode !== "production") ||
    (requireCheckout && process.env["MP_GATEWAY_CHECKOUT_ENABLED"] !== "true"))
    throw new Error("Checkout indisponível.");
  const token = process.env[mode === "sandbox" ? "MP_ACCESS_TOKEN_TEST" : "MP_ACCESS_TOKEN_LIVE"];
  const collector = Number(process.env[mode === "sandbox" ? "MP_COLLECTOR_ID_TEST" : "MP_COLLECTOR_ID_LIVE"]);
  if (!token || token.length < 20 || !Number.isSafeInteger(collector) || collector <= 0)
    throw new Error("Credenciais de adquirência não configuradas.");
  return { mode, token, collector };
}

async function requestMercadoPago(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!response.ok) throw new Error("Operação financeira indisponível.");
  return response.json() as Promise<Record<string, unknown>>;
}

export type MpPreference = { preferenceId: string; checkoutUrl: string };

export async function createMercadoPagoPreference(input: {
  purchaseId: string; priceCents: number; payerEmail: string;
  callbackBaseUrl: string;
}): Promise<MpPreference> {
  const cred = credentials(true);
  if (!UUID.test(input.purchaseId) || !Number.isInteger(input.priceCents) ||
    input.priceCents < 100 || input.priceCents > 99900 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.payerEmail) || input.payerEmail.length > 254)
    throw new Error("Aquisição inválida.");
  // Only production canonical host or an explicitly configured HTTPS Preview.
  const base = new URL(input.callbackBaseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.port || base.search || base.hash ||
    base.pathname !== "/" ||
    (base.hostname !== "www.encontreumtecnico.com.br" &&
      !(cred.mode === "sandbox" && base.hostname === process.env["MP_SANDBOX_HOST"])))
    throw new Error("Endereço de retorno não autorizado.");
  const reference = `eut_contact_${input.purchaseId}`;
  const result = await requestMercadoPago(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Accept: "application/json", "Content-Type": "application/json",
      Authorization: `Bearer ${cred.token}`, "X-Idempotency-Key": input.purchaseId,
    },
    body: JSON.stringify({
      items: [{ id: "eut-contact-access", title: "Acesso a contato de técnico", quantity: 1,
        currency_id: "BRL", unit_price: input.priceCents / 100 }],
      external_reference: reference,
      payer: { email: input.payerEmail },
      back_urls: {
        success: `${base.origin}/ajuda-acesso`, pending: `${base.origin}/ajuda-acesso`,
        failure: `${base.origin}/ajuda-acesso`,
      },
      auto_return: "approved",
      notification_url: `${base.origin}/api/mercadopago/webhook`,
    }),
  });
  const preferenceId = result["id"];
  const redirect = cred.mode === "sandbox" ? result["sandbox_init_point"] : result["init_point"];
  const checkoutUrl = safeMercadoPagoUrl(redirect);
  if (typeof preferenceId !== "string" || !/^[A-Za-z0-9_-]{8,160}$/.test(preferenceId) ||
    !checkoutUrl || result["collector_id"] !== cred.collector)
    throw new Error("Preferência divergente; checkout bloqueado.");
  return { preferenceId, checkoutUrl };
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const cred = credentials();
  if (!/^[1-9][0-9]{0,19}$/.test(paymentId)) throw new Error("Pagamento inválido.");
  const payment = await requestMercadoPago(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${cred.token}`, Accept: "application/json" },
  });
  return { payment, collectorId: cred.collector, liveMode: cred.mode === "production" };
}
