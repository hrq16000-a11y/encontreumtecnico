/**
 * Adaptador de homologação Checkout Pro / Orders API.
 *
 * DELIBERADAMENTE NÃO LIGADO AO FRONTEND, À AUTENTICAÇÃO OU AO BANCO.
 * Nenhuma operação real é possível sem configuração explícita de sandbox.
 * A integração definitiva exige uma aquisição persistida e protegida por RLS/RPC,
 * idempotência transacional e verificação de Webhook antes de liberar contatos.
 */
import { quoteContactAccess, type BrazilPaymentTimeZone } from "./mercado-pago-pricing";

const ORDER_API = "https://api.mercadopago.com/v1/orders";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SandboxContactCheckoutInput = {
  /** Identificador de aquisição gerado e persistido transacionalmente no backend. */
  acquisitionId: string;
  /** UUID estável de uma mesma tentativa; não regenerar ao repetir um timeout. */
  idempotencyKey: string;
  /** E-mail vindo do usuário autenticado no backend, não do formulário. */
  payerEmail: string;
  /** Fuso resolvido no backend a partir da cidade/localidade do atendimento. */
  timeZone: BrazilPaymentTimeZone;
};

export type SandboxContactCheckout = {
  orderId: string;
  checkoutUrl: string;
  amountCents: 999 | 2999;
  period: "regular" | "after_hours";
  pricedAt: string;
  priceRule: "contact-access-v1";
};

function isTrustedMercadoPagoCheckout(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "mercadopago.com.br" || url.hostname.endsWith(".mercadopago.com.br"));
  } catch {
    return false;
  }
}

/**
 * Test-only: não fornece rota pública nem libera contato.
 * NUNCA habilitar MP_SANDBOX_ORDERS_ENABLED em produção.
 */
export async function createSandboxContactCheckout(
  input: SandboxContactCheckoutInput,
  at = new Date(),
): Promise<SandboxContactCheckout> {
  if (process.env["MP_CHECKOUT_MODE"] !== "sandbox"
    || process.env["MP_SANDBOX_ORDERS_ENABLED"] !== "true") {
    throw new Error("Integração Mercado Pago desabilitada.");
  }

  const accessToken = process.env["MP_ACCESS_TOKEN_TEST"]?.trim();
  if (!accessToken) throw new Error("Credencial de teste indisponível.");
  if (!UUID_RE.test(input.acquisitionId) || !UUID_RE.test(input.idempotencyKey))
    throw new Error("Identificação de aquisição inválida.");
  if (input.payerEmail.length > 254 || !EMAIL_RE.test(input.payerEmail))
    throw new Error("E-mail de comprador inválido.");

  const quote = quoteContactAccess(at, input.timeZone);
  const externalReference = "eut_contact_" + input.acquisitionId;
  const payload = {
    type: "online",
    processing_mode: "manual",
    total_amount: quote.amountBRL,
    external_reference: externalReference,
    description: "Acesso ao contato de um técnico — Encontre um Técnico",
    payer: { email: input.payerEmail },
    items: [{
      title: "Acesso a contato de técnico",
      quantity: 1,
      unit_price: quote.amountBRL,
    }],
  };

  const result = await fetch(ORDER_API, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken,
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  // Nunca devolver o corpo bruto da API (pode conter dados pessoais/detalhes).
  if (!result.ok) throw new Error("Falha na criação da ordem de teste.");
  const response = await result.json() as Record<string, unknown>;
  if (typeof response["id"] !== "string"
    || !/^ORD[A-Z0-9_-]+$/i.test(response["id"])
    || !isTrustedMercadoPagoCheckout(response["checkout_url"])
    || response["external_reference"] !== externalReference
    || response["total_amount"] !== quote.amountBRL
    || response["currency"] !== "BRL"
    || response["country_code"] !== "BRA") {
    throw new Error("Resposta da ordem divergente; acesso não autorizado.");
  }

  return {
    orderId: response["id"],
    checkoutUrl: response["checkout_url"],
    amountCents: quote.amountCents,
    period: quote.period,
    pricedAt: quote.pricedAt,
    priceRule: quote.priceRule,
  };
}
