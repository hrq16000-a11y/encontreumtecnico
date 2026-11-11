/**
 * WhatsApp Business Platform Cloud API adapter — STAGED, NOT CONNECTED.
 *
 * There is intentionally no route, job or client import calling this module.
 * Setting credentials alone does not activate automated delivery.
 *
 * Future activation requires: owner-controlled WABA, approved pt_BR template,
 * recipient opt-in, lead persisted in database, durable once-only outbox, signed
 * webhook verified, verified QA and explicit release approval.
 * Do NOT send private technician phone numbers, secrets or auth credentials.
 */
export type WhatsAppEnvironment = Record<string, string | undefined>;

export type ConfirmedLeadForOperator = {
  id: string; // durable database ID, not a client-generated identifier
  service: string;
  city: string;
  urgency: string;
  persisted: true;
  whatsappOptIn: true;
  outboxClaimedOnce: true; // verified atomic claim from a future durable queue
};

export type WhatsAppDispatchResult =
  | { status: "disabled" }
  | { status: "blocked"; reason: "missing_configuration" | "invalid_configuration" | "missing_proof" }
  | { status: "api_error"; httpStatus: number }
  | { status: "accepted_by_meta"; messageId: string };

const digits = /^[1-9][0-9]{9,14}$/;
const identifier = /^[1-9][0-9]{5,30}$/;
const templateName = /^[a-z0-9_]{3,180}$/;
const version = /^v[0-9]{2,3}\.[0-9]+$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value: string, max: number) {
  return value.replace(/[\r\n<>]/g, " ").trim().slice(0, max);
}

export function prepareWhatsAppCloudDelivery(env: WhatsAppEnvironment, lead: ConfirmedLeadForOperator) {
  // Never infer enablement from the presence of a token.
  if (env.EUT_WHATSAPP_CLOUD_SEND_ENABLED !== "true") {
    return { status: "disabled" as const };
  }
  if (!lead.persisted || !lead.whatsappOptIn || !lead.outboxClaimedOnce || !uuid.test(lead.id)) {
    return { status: "blocked" as const, reason: "missing_proof" as const };
  }
  const token = env.EUT_WHATSAPP_CLOUD_ACCESS_TOKEN ?? "";
  const phoneId = env.EUT_WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? "";
  const recipient = env.EUT_WHATSAPP_CLOUD_RECIPIENT_E164 ?? "";
  const approvedTemplate = env.EUT_WHATSAPP_CLOUD_APPROVED_TEMPLATE ?? "";
  const apiVersion = env.EUT_WHATSAPP_CLOUD_API_VERSION ?? "";
  if (!token || !phoneId || !recipient || !approvedTemplate || !apiVersion) {
    return { status: "blocked" as const, reason: "missing_configuration" as const };
  }
  if (!identifier.test(phoneId) || !digits.test(recipient) || !templateName.test(approvedTemplate)
    || !version.test(apiVersion) || token.length < 24) {
    return { status: "blocked" as const, reason: "invalid_configuration" as const };
  }
  const service = clean(lead.service, 80);
  const city = clean(lead.city, 60) || "não informada";
  const urgency = clean(lead.urgency, 60);
  if (service.length < 2 || urgency.length < 2) {
    return { status: "blocked" as const, reason: "missing_proof" as const };
  }
  // Template text/variables must exactly match an approved operator notification.
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: approvedTemplate,
      language: { code: "pt_BR" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: lead.id },
          { type: "text", text: service },
          { type: "text", text: city },
          { type: "text", text: urgency },
        ],
      }],
    },
  };
  return {
    status: "ready" as const,
    url: "https://graph.facebook.com/" + apiVersion + "/" + phoneId + "/messages",
    token,
    body,
  };
}

/** For a future restricted server-side outbox worker ONLY; never call from a route/client.
 * Accepted by Meta is not the same as delivered to the recipient.
 */
export async function deliverOptedInLeadFromDurableOutbox(
  env: WhatsAppEnvironment,
  lead: ConfirmedLeadForOperator,
  fetcher: typeof fetch = fetch,
): Promise<WhatsAppDispatchResult> {
  const prep = prepareWhatsAppCloudDelivery(env, lead);
  if (prep.status !== "ready") return prep;
  try {
    const response = await fetcher(prep.url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + prep.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prep.body),
    });
    if (!response.ok) return { status: "api_error", httpStatus: response.status };
    const data: unknown = await response.json();
    const first = (data as { messages?: Array<{ id?: unknown }> } | null)?.messages?.[0]?.id;
    if (typeof first !== "string" || !first.startsWith("wamid.")) {
      return { status: "api_error", httpStatus: response.status };
    }
    return { status: "accepted_by_meta", messageId: first };
  } catch {
    // A lost API response may represent a successful send. Never blindly retry;
    // future outbox worker must reconcile by provider ID and webhook state.
    return { status: "api_error", httpStatus: 0 };
  }
}
