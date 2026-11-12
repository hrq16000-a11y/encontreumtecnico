import { describe, expect, it, vi } from "vitest";
import {
  deliverOptedInLeadFromDurableOutbox,
  prepareWhatsAppCloudDelivery,
  type ConfirmedLeadForOperator,
} from "./whatsapp-cloud-adapter.server";

const valid: ConfirmedLeadForOperator = {
  id: "b190db33-86e1-4cf4-b916-a1f4eac56720",
  service: "Redes e Wi-Fi",
  city: "Curitiba",
  urgency: "Nos próximos dias",
  persisted: true,
  whatsappOptIn: true,
  outboxClaimedOnce: true,
};
const configured = {
  EUT_WHATSAPP_CLOUD_SEND_ENABLED: "true",
  EUT_WHATSAPP_CLOUD_PHONE_NUMBER_ID: "123456789012345",
  EUT_WHATSAPP_CLOUD_RECIPIENT_E164: "5541997452053",
  EUT_WHATSAPP_CLOUD_APPROVED_TEMPLATE: "alerta_novo_lead_portal",
  EUT_WHATSAPP_CLOUD_API_VERSION: "v23.0",
  EUT_WHATSAPP_CLOUD_ACCESS_TOKEN: "test-token-not-valid-for-production-12345",
};

describe("WhatsApp Business Cloud API — integração preparada, não ativada", () => {
  it("não dispara nada se a flag explícita estiver ausente, mesmo com credenciais", async () => {
    const fetcher = vi.fn(async () => { throw new Error("should never execute"); });
    expect(prepareWhatsAppCloudDelivery({ ...configured, EUT_WHATSAPP_CLOUD_SEND_ENABLED: undefined }, valid)).toEqual({ status: "disabled" });
    expect(await deliverOptedInLeadFromDurableOutbox({
      ...configured,
      EUT_WHATSAPP_CLOUD_SEND_ENABLED: "false",
    }, valid, fetcher as unknown as typeof fetch)).toEqual({ status: "disabled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejeita ausência de opt-in, persistência e deduplicação durável", async () => {
    const fetcher = vi.fn();
    for (const change of [
      { whatsappOptIn: false },
      { outboxClaimedOnce: false },
      { persisted: false },
      { id: "not-a-durable-id" },
    ]) {
      expect(prepareWhatsAppCloudDelivery(configured, { ...valid, ...change } as ConfirmedLeadForOperator)).toEqual({
        status: "blocked", reason: "missing_proof",
      });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("exige cinco configurações válidas e nunca confunde número de técnico com destinatário", () => {
    expect(prepareWhatsAppCloudDelivery({ EUT_WHATSAPP_CLOUD_SEND_ENABLED: "true" }, valid)).toEqual({
      status: "blocked", reason: "missing_configuration",
    });
    const prep = prepareWhatsAppCloudDelivery(configured, valid);
    expect(prep.status).toBe("ready");
    if (prep.status !== "ready") return;
    expect(prep.url).toBe("https://graph.facebook.com/v23.0/123456789012345/messages");
    expect(prep.body.to).toBe("5541997452053");
    expect(prep.body.type).toBe("template");
    expect(prep.body.template.language.code).toBe("pt_BR");
    expect(JSON.stringify(prep.body)).not.toContain("password");
    expect(JSON.stringify(prep.body)).not.toContain("email");
    expect(JSON.stringify(prep.body)).not.toContain(prep.token);
    expect(prep.body.template.components[0]?.parameters).toHaveLength(4);
    expect(prepareWhatsAppCloudDelivery({
      ...configured, EUT_WHATSAPP_CLOUD_PHONE_NUMBER_ID: "../../bad",
    }, valid)).toEqual({ status: "blocked", reason: "invalid_configuration" });
  });

  it("aceitação da Meta não significa entrega; erros não provocam retries automáticos", async () => {
    const fetcher = vi.fn(async (_input: unknown, _init: unknown) => ({
      ok: true, status: 200,
      json: async () => ({ messages: [{ id: "wamid.some-opaque-id" }] }),
    }));
    const result = await deliverOptedInLeadFromDurableOutbox(configured, valid, fetcher as unknown as typeof fetch);
    expect(result).toEqual({ status: "accepted_by_meta", messageId: "wamid.some-opaque-id" });
    expect(fetcher).toHaveBeenCalledOnce();
    const request = fetcher.mock.calls[0]?.[1] as { headers: { Authorization: string } } | undefined;
    expect(request?.headers.Authorization).toContain("Bearer ");
    expect(await deliverOptedInLeadFromDurableOutbox(configured, valid,
      vi.fn(async () => { throw new Error("network uncertainty"); }) as unknown as typeof fetch))
      .toEqual({ status: "api_error", httpStatus: 0 });
  });
});
