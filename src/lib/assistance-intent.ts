export type AssistanceMode = "direct" | "managed";

type LeadFields = {
  mode: AssistanceMode;
  name: string; email: string; service: string; when: string;
  problem: string; city: string; uf: string; neighborhood: string;
};

/** Must never grant access, store card data or submit to a technician directly. */
export function buildAssistanceLead(fields: LeadFields) {
  const name = fields.name.trim().slice(0, 100);
  const email = fields.email.trim().slice(0, 255);
  const service = fields.service.trim().slice(0, 100);
  const issue = fields.problem.trim().slice(0, 1400);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    service.length < 2 || issue.length < 10) return null;
  const location = [fields.neighborhood, fields.city, fields.uf].map(s => s.trim().slice(0, 80)).filter(Boolean).join(" · ");
  return {
    name, email,
    subject: (fields.mode === "managed" ? "Gestão assistida sem antecipação — " : "Interesse em aquisição de contato (NÃO PAGO) — ") + service,
    message: [
      "Solicitação originada no funil guiado do Encontre um Técnico.",
      "Modalidade: " + (fields.mode === "managed" ? "Gestão da equipe, sem pagamento antecipado" : "Contato direto, apenas interesse, nenhum pagamento efetuado"),
      "Serviço: " + service,
      "Quando: " + fields.when.trim().slice(0, 80),
      "Localidade aproximada ou informada: " + (location || "não identificada"),
      "Problema: " + issue,
      "Status: contato ainda não liberado; esta solicitação não confirma nenhuma compra.",
    ].join("\n"),
  };
}
