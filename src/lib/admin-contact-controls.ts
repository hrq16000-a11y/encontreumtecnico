export type AdminContactAction =
  | "block_account" | "unblock_account" | "suspend_account"
  | "request_review" | "block_phone" | "unblock_phone" | "mark_message";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function canRevealAdminContact(reason: unknown): reason is string {
  return typeof reason === "string" && reason.trim().length >= 8 &&
    reason.trim().length <= 500 && !/[\u0000-\u001f\u007f]/.test(reason);
}

/** Client-side validation only; database RPC still checks admin role and records audit. */
export function validateAdminContactAction(data: {
  action: AdminContactAction; reason: string;
  userId: string | null; phone: string; blockId: string | null;
  messageId: string | null; messageStatus: string;
}): string | null {
  if (!canRevealAdminContact(data.reason)) return "Informe motivo administrativo de 8 a 500 caracteres.";
  if (data.action === "block_phone") {
    const digits = data.phone.replace(/\D/g, "");
    if (!/^(?:55)?[1-9]{2}[2-9]\d{7,8}$/.test(digits))
      return "Informe um telefone brasileiro completo com DDD.";
    return null;
  }
  if (data.action === "unblock_phone")
    return !data.blockId || !UUID.test(data.blockId) ? "Selecione um bloqueio telefônico válido." : null;
  if (data.action === "mark_message") {
    if (!data.messageId || !UUID.test(data.messageId) ||
        !["nova", "respondida", "arquivada"].includes(data.messageStatus))
      return "Selecione mensagem e situação válidas.";
    return null;
  }
  return !data.userId || !UUID.test(data.userId) ? "Selecione uma conta válida." : null;
}
