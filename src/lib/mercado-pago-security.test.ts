import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkedMercadoPagoPayment, safeMercadoPagoUrl, verifyMercadoPagoWebhook } from "./mercado-pago-security.server";
import { createMercadoPagoPreference, fetchMercadoPagoPayment } from "./mercado-pago-preferences.server";

const purchaseId = "7da956f3-f81d-40fe-a87a-6c2e0951df24";
const paymentId = "123456789";
const now = Date.parse("2026-11-20T12:00:00Z");
const secret = "MP_HMAC_TEST_SECRET_DO_NOT_DEPLOY_123";
const requestId = "a1b2c3d4-1234-5678-90ab-cdef01234567";

function sign(dataId = paymentId, at = now) {
  const ts = String(Math.round(at / 1000));
  const digest = createHmac("sha256", secret)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${digest}`;
}

const payment = {
  id: Number(paymentId), status: "approved", currency_id: "BRL",
  external_reference: `eut_contact_${purchaseId}`, collector_id: 987654321,
  live_mode: false, transaction_amount: 9.99, refunded_amount: 0,
  date_approved: "2026-11-20T12:00:00Z",
};
const expected = { purchaseId, priceCents: 999, collectorId: 987654321, liveMode: false };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Mercado Pago: autenticação e reconciliação", () => {
  it("aceita apenas webhook autenticado com manifesto e timestamp coerentes", () => {
    const data = { signature: sign(), requestId, dataId: paymentId, secret, now };
    expect(verifyMercadoPagoWebhook(data)).toBe(true);
    expect(verifyMercadoPagoWebhook({ ...data, dataId: "123456788" })).toBe(false);
    expect(verifyMercadoPagoWebhook({ ...data, requestId: "different-id" })).toBe(false);
    expect(verifyMercadoPagoWebhook({ ...data, secret: "wrong" })).toBe(false);
    expect(verifyMercadoPagoWebhook({ ...data, signature: sign(paymentId, now - 25 * 3600_000) })).toBe(false);
    expect(verifyMercadoPagoWebhook({ ...data, signature: null })).toBe(false);
  });
  it("nunca concede direito por redirecionamento, valor ou vendedor divergente", () => {
    expect(checkedMercadoPagoPayment(payment, expected)?.paymentId).toBe(paymentId);
    for (const bad of [
      { status: "pending" }, { status: "rejected" }, { status: "refunded" },
      { currency_id: "USD" }, { external_reference: "eut_contact_other" },
      { transaction_amount: 29.99 }, { collector_id: 5 }, { live_mode: true },
      { refunded_amount: 9.99 }, { date_approved: null },
    ]) expect(checkedMercadoPagoPayment({ ...payment, ...bad }, expected)).toBeNull();
    expect(checkedMercadoPagoPayment(payment, { ...expected, purchaseId: "../" })).toBeNull();
  });
  it("bloqueia URLs externas mesmo com nomes parecidos", () => {
    expect(safeMercadoPagoUrl("https://www.mercadopago.com.br/checkout/v1/pay")).toContain("mercadopago");
    for (const bad of ["http://www.mercadopago.com.br", "https://mercadopago.com.br.evil.com/pay",
      "https://evil.com@mercadopago.com.br/pay", "https://attacker.example/pay", "javascript:alert(1)"]) {
      expect(safeMercadoPagoUrl(bad)).toBeNull();
    }
  });
});

describe("Mercado Pago: criação de preferência com proteção de ambiente", () => {
  function enable() {
    vi.stubEnv("MP_CHECKOUT_MODE", "sandbox");
    vi.stubEnv("MP_GATEWAY_CHECKOUT_ENABLED", "true");
    vi.stubEnv("MP_ACCESS_TOKEN_TEST", "TEST-EXAMPLE_SECRET_NOT_REAL_123456789");
    vi.stubEnv("MP_COLLECTOR_ID_TEST", "987654321");
  }
  const input = { purchaseId, priceCents: 999, payerEmail: "buyer@example.com",
    callbackBaseUrl: "https://www.encontreumtecnico.com.br/" };
  const preference = {
    id: "PREF12345678", collector_id: 987654321,
    sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout?pref=PREF12345678",
  };
  it("permanece desativado por padrão sem chamadas externas", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(createMercadoPagoPreference(input)).rejects.toThrow("Checkout indisponível");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("usa preço e referência definidos no servidor, sem telefone no PSP", async () => {
    enable();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => preference }));
    vi.stubGlobal("fetch", fetcher);
    const result = await createMercadoPagoPreference(input);
    expect(result.preferenceId).toBe(preference.id);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    const payload = JSON.parse(String(options.body));
    expect(payload.external_reference).toBe(`eut_contact_${purchaseId}`);
    expect(payload.items[0].unit_price).toBe(9.99);
    expect(payload.notification_url).toBe("https://www.encontreumtecnico.com.br/api/mercadopago/webhook");
    expect(JSON.stringify(payload)).not.toMatch(/phone_e164|technician_phone|service_role|contact_entitlement/i);
  });
  it("falha fechado diante de resposta de outro vendedor ou checkout falso", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true,
      json: async () => ({ ...preference, collector_id: 55 }) })));
    await expect(createMercadoPagoPreference(input)).rejects.toThrow("divergente");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true,
      json: async () => ({ ...preference, sandbox_init_point: "https://evil.example/checkout" }) })));
    await expect(createMercadoPagoPreference(input)).rejects.toThrow("divergente");
  });
  it("nega callbacks não aprovados e IDs fora do formato", async () => {
    enable();
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(createMercadoPagoPreference({ ...input, callbackBaseUrl: "https://attacker.vercel.app/" })).rejects.toThrow("não autorizado");
    await expect(createMercadoPagoPreference({ ...input, purchaseId: "../" })).rejects.toThrow("inválida");
    await expect(fetchMercadoPagoPayment("../secret")).rejects.toThrow("inválido");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("consulta status mesmo após desativar checkout, para conciliar estornos", async () => {
    enable(); vi.stubEnv("MP_GATEWAY_CHECKOUT_ENABLED", "false");
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => payment }));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchMercadoPagoPayment(paymentId)).payment["status"]).toBe("approved");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
