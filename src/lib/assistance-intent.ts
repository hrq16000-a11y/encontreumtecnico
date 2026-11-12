export type AssistanceMode = "direct" | "managed";

type LeadFields = {
  mode: AssistanceMode;
  name: string; email: string; service: string; when: string;
  problem: string; city: string; uf: string; neighborhood: string;
  technicianId?: string | undefined; technicianName?: string | undefined;
  sourceGuide?: string | undefined;
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
  const technicianId = typeof fields.technicianId === "string" && /^[0-9a-f-]{36}$/i.test(fields.technicianId) ? fields.technicianId : "";
  const technicianName = typeof fields.technicianName === "string" ? fields.technicianName.replace(/[\r\n<>]/g, " ").trim().slice(0, 100) : "";
  const sourceGuide = typeof fields.sourceGuide === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.sourceGuide) && fields.sourceGuide.length <= 96
    ? fields.sourceGuide : "";
  return {
    name, email,
    subject: (fields.mode === "managed" ? "Gestão assistida sem antecipação — " : "Interesse em aquisição de contato (NÃO PAGO) — ") + service,
    message: [
      "Solicitação originada no funil guiado do Encontre um Técnico.",
      "Modalidade: " + (fields.mode === "managed" ? "Gestão da equipe, sem pagamento antecipado" : "Contato direto, apenas interesse, nenhum pagamento efetuado"),
      "Serviço: " + service,
      ...(sourceGuide ? ["Origem do pedido: Guia público /guias/" + sourceGuide] : []),
      "Técnico de interesse: " + (technicianName || "não selecionado") + (technicianId ? " (perfil " + technicianId + ")" : ""),
      "Quando: " + fields.when.trim().slice(0, 80),
      "Localidade aproximada ou informada: " + (location || "não identificada"),
      "Problema: " + issue,
      "Status: contato ainda não liberado; esta solicitação não confirma nenhuma compra.",
    ].join("\n"),
  };
}
