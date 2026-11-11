/** Prepared client-initiated WhatsApp handoff AFTER durable database insert.
 * This does not send a message, confirm delivery or unlock any private number.
 * Keep the destination out of public profiles, CTAs and SEO markup.
 */
const BUSINESS_WHATSAPP = "5541997452053";
export type SavedAssistanceLead = { name: string; email: string; subject: string; message: string };

export function buildSavedLeadWhatsAppUrl(lead: SavedAssistanceLead): string {
  const name = lead.name.trim().slice(0, 100).replace(/[\r\n<>]/g, " ");
  const email = lead.email.trim().slice(0, 255).replace(/[\r\n<>]/g, " ");
  const subject = lead.subject.trim().slice(0, 160).replace(/[\r\n<>]/g, " ");
  const details = lead.message.trim().slice(0, 2500).replace(/[<>]/g, "");
  if (!name || !email || !subject || !details) throw new Error("Invalid saved lead");
  const msg = [
    "Olá, equipe Encontre um Técnico!",
    "Já registrei este pedido no funil do portal e gostaria de continuar o atendimento.",
    "",
    "Cliente: " + name,
    "E-mail para retorno: " + email,
    "Assunto: " + subject,
    "",
    details,
    "",
    "O envio desta conversa não concede acesso ao telefone privado de nenhum técnico nem confirma pagamento.",
  ].join("\n");
  return "https://api.whatsapp.com/send?phone=" + BUSINESS_WHATSAPP + "&text=" + encodeURIComponent(msg);
}
