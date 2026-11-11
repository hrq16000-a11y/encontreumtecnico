/**
 * Design-only Meta webhook verification primitives.
 *
 * NOT wired to any route or job. No credentials read from environment.
 * A future server-only route may use these only after DB outbox, opt-in,
 * Meta credentials and webhook approval are independently homologated.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PATTERN = /^sha256=([a-f0-9]{64})$/i;
const NUMERIC_CHALLENGE = /^[0-9]{1,128}$/;

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** GET /webhook handshake: return challenge for the exact configured token only. */
export function verifyMetaWebhookChallenge(params: URLSearchParams, expectedToken: string): string | null {
  const mode = params.get("hub.mode");
  const provided = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";
  if (mode !== "subscribe" || expectedToken.length < 20 || !NUMERIC_CHALLENGE.test(challenge)) return null;
  return secretMatches(provided, expectedToken) ? challenge : null;
}

/** POST: compare the HMAC of the ORIGINAL, UNPARSED request body.
 * Never hash a reserialized JSON object; that can change the raw bytes.
 */
export function verifyMetaWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !SIGNATURE_PATTERN.test(signatureHeader) || appSecret.length < 20 || rawBody.length === 0) {
    return false;
  }
  const claimed = Buffer.from(signatureHeader.slice(7), "hex");
  if (claimed.length !== 32) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, claimed);
}

export type WhatsAppDeliveryStage = "queued" | "claimed" | "accepted_by_meta" | "sent" | "delivered" | "read" | "failed" | "uncertain";

/** Webhook statuses can arrive out of order and multiple times.
 * Do not downgrade delivered/read to sent, and never confuse HTTP acceptance with delivery.
 */
export function shouldAdvanceWhatsAppStatus(current: WhatsAppDeliveryStage, incoming: WhatsAppDeliveryStage): boolean {
  if (current === incoming) return false;
  if (current === "read") return false;
  if (current === "delivered") return incoming === "read";
  if (current === "failed") return ["sent", "delivered", "read"].includes(incoming);
  if (incoming === "failed" || incoming === "uncertain") return ["queued", "claimed", "accepted_by_meta", "sent", "uncertain"].includes(current);
  const rank: Record<WhatsAppDeliveryStage, number> = {
    queued: 0, claimed: 1, accepted_by_meta: 2, sent: 3, delivered: 4, read: 5,
    failed: -1, uncertain: -1,
  };
  return rank[incoming] > rank[current];
}
