import { afterEach, describe, expect, it, vi } from "vitest";
import { quoteContactAccess } from "./mercado-pago-pricing";
import { createSandboxContactCheckout } from "./mercado-pago-orders.server";

const acquisitionId = "6d9404ac-11e5-45b3-a941-e9ba5fbd3a73";
const idempotencyKey = "713ec750-00e0-4d9e-9b64-aa993018baef";
const at = new Date("2026-11-11T12:00:00.000Z");
const input = {
  acquisitionId,
  idempotencyKey,
  payerEmail: "comprador@example.com",
  timeZone: "America/Sao_Paulo" as const,
};
const order = {
  id: "ORDTST123456",
  checkout_url: "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORDTST123456",
  external_reference: "eut_contact_" + acquisitionId,
  total_amount: "9.99",
  country_code: "BRA",
  currency: "BRL",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Mercado Pago: cotação protegida", () => {
  it("cobra R$ 9,99 a partir das 09:00 locais", () => {
    expect(quoteContactAccess(at, "America/Sao_Paulo").amountCents).toBe(999);
  });
  it("cobra R$ 29,99 às 08:59 e às 18:00", () => {
    expect(quoteContactAccess(new Date("2026-11-11T11:59:00Z"), "America/Sao_Paulo").amountCents).toBe(2999);
    expect(quoteContactAccess(new Date("2026-11-11T21:00:00Z"), "America/Sao_Paulo").amountCents).toBe(2999);
  });
  it("respeita o fuso da região de atendimento", () => {
    expect(quoteContactAccess(at, "America/Rio_Branco").amountCents).toBe(2999);
    expect(quoteContactAccess(at, "America/Sao_Paulo").amountCents).toBe(999);
  });
  it("falha fechado para data ou fuso inválidos", () => {
    expect(() => quoteContactAccess(new Date("inválida"), "America/Sao_Paulo")).toThrow();
    expect(() => quoteContactAccess(at, "UTC" as never)).toThrow();
  });
});

describe("Mercado Pago: adaptador de homologação Orders API", () => {
  function enableSandbox() {
    vi.stubEnv("MP_CHECKOUT_MODE", "sandbox");
    vi.stubEnv("MP_SANDBOX_ORDERS_ENABLED", "true");
    vi.stubEnv("MP_ACCESS_TOKEN_TEST", "TEST_TOKEN_PLACEHOLDER");
  }
  it("permanece desligado por padrão, sem chamadas à rede", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(createSandboxContactCheckout(input, at)).rejects.toThrow("desabilitada");
    expect(request).not.toHaveBeenCalled();
  });
  it("cria somente ordem de teste com valor calculado e chave idempotente", async () => {
    enableSandbox();
    const request = vi.fn(async () => ({ ok: true, json: async () => order }));
    vi.stubGlobal("fetch", request);
    const result = await createSandboxContactCheckout(input, at);
    expect(result.amountCents).toBe(999);
    expect(result.orderId).toBe(order.id);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/orders");
    expect((options.headers as Record<string, string>)["X-Idempotency-Key"]).toBe(idempotencyKey);
    const payload = JSON.parse(String(options.body));
    expect(payload.total_amount).toBe("9.99");
    expect(payload.items[0].unit_price).toBe("9.99");
    expect(payload.external_reference).toBe(order.external_reference);
  });
  it("rejeita checkout URL não confiável, sem liberar contatos", async () => {
    enableSandbox();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ ...order, checkout_url: "https://fake-checkout.example/pay" }),
    })));
    await expect(createSandboxContactCheckout(input, at)).rejects.toThrow("divergente");
  });
  it("rejeita divergência de moeda, valor e referência", async () => {
    enableSandbox();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ ...order, total_amount: "29.99" }),
    })));
    await expect(createSandboxContactCheckout(input, at)).rejects.toThrow("divergente");
  });
  it("rejeita IDs inválidos antes de chamar a API", async () => {
    enableSandbox();
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(createSandboxContactCheckout({ ...input, acquisitionId: "../qualquer" }, at)).rejects.toThrow("inválida");
    expect(request).not.toHaveBeenCalled();
  });
});
