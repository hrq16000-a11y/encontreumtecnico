import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
  shouldAdvanceWhatsAppStatus,
} from "./whatsapp-webhook-design.server";

const token = "staging-only-verification-token-12345";
const secret = "staging-only-meta-app-secret-strong";
describe("contrato de webhook WhatsApp Business desativado", () => {
  it("valida desafio GET somente com token correto e modo subscribe", () => {
    const good = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": token,
      "hub.challenge": "782643091",
    });
    expect(verifyMetaWebhookChallenge(good, token)).toBe("782643091");
    expect(verifyMetaWebhookChallenge(good, "different-and-long-verification-token")).toBeNull();
    good.set("hub.mode", "unsubscribe");
    expect(verifyMetaWebhookChallenge(good, token)).toBeNull();
    good.set("hub.mode", "subscribe");
    good.set("hub.challenge", "<script>");
    expect(verifyMetaWebhookChallenge(good, token)).toBeNull();
  });

  it("exige assinatura HMAC-SHA256 calculada sobre bytes exatos do POST", () => {
    const raw = Buffer.from('{"object":"whatsapp_business_account","entry":[]}', "utf8");
    const signature = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    expect(verifyMetaWebhookSignature(raw, signature, secret)).toBe(true);
    expect(verifyMetaWebhookSignature(Buffer.from(raw.toString().replace("entry", "other")), signature, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(raw, signature, secret + "altered")).toBe(false);
    expect(verifyMetaWebhookSignature(raw, null, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(raw, "sha256=nothex", secret)).toBe(false);
    expect(verifyMetaWebhookSignature(Buffer.from(""), signature, secret)).toBe(false);
  });

  it("não confunde aceitação da Meta com entrega e ignora estados repetidos ou antigos", () => {
    expect(shouldAdvanceWhatsAppStatus("queued", "claimed")).toBe(true);
    expect(shouldAdvanceWhatsAppStatus("accepted_by_meta", "delivered")).toBe(true);
    expect(shouldAdvanceWhatsAppStatus("delivered", "read")).toBe(true);
    expect(shouldAdvanceWhatsAppStatus("delivered", "sent")).toBe(false);
    expect(shouldAdvanceWhatsAppStatus("accepted_by_meta", "accepted_by_meta")).toBe(false);
    expect(shouldAdvanceWhatsAppStatus("read", "failed")).toBe(false);
    expect(shouldAdvanceWhatsAppStatus("uncertain", "queued")).toBe(false);
    expect(shouldAdvanceWhatsAppStatus("failed", "delivered")).toBe(true);
  });

  it("mantém adaptação de webhook fora de rotas e do funil até aprovação de banco e credenciais", () => {
    const funnel = readFileSync("src/components/assistance-funnel.tsx", "utf8");
    const newAdapter = readFileSync("src/lib/whatsapp-webhook-design.server.ts", "utf8");
    const docs = readFileSync("docs/integrations/whatsapp-cloud-outbox-webhook-design.md", "utf8");
    expect(newAdapter).not.toContain("createFileRoute");
    expect(newAdapter).not.toContain("createServerFn");
    expect(funnel).not.toContain("verifyMetaWebhookSignature");
    expect(funnel).not.toContain("whatsapp_notification_outbox");
    expect(docs).toContain("NÃO EXECUTAR");
    expect(docs).toContain("FOR UPDATE SKIP LOCKED");
  });
});
