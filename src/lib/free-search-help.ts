export type FreeHelpContext = {
  city?: string;
  uf?: string;
  neighborhood?: string;
  service?: string;
  technicianId?: string;
  technicianName?: string;
  mode?: "direct" | "managed";
  guideSlug?: string;
  initialProblem?: string;
  sourcePath?: string;
  placement?: string;
};

const clean = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[\r\n<>]/g, " ").trim().slice(0, 80)
    : "";

export function freeHelpCopy(context: FreeHelpContext = {}) {
  const location = [context.neighborhood, context.city, context.uf].map(clean).filter(Boolean).join(" · ");
  const service = clean(context.service);
  return {
    location: location || "sua região",
    subject: "Ajuda gratuita para localizar um técnico",
    message: [
      "Solicito ajuda gratuita para encontrar um técnico pelo portal.",
      "Localidade informada: " + (location || "não informada") + ".",
      "Serviço ou categoria: " + (service || "não informado") + ".",
      "",
      "Detalhes do que preciso: ",
    ].join("\n"),
  };
}

/** Contextual help always enters the existing managed funnel, not a raw phone or email. */
export function portalHelpContext(
  source: "home" | "contato",
  reason: "geral" | "privacidade" = "geral",
): FreeHelpContext {
  const page = source === "home" ? "página inicial" : "página de contato";
  const request = reason === "privacidade"
    ? "Quero ajuda com privacidade ou meus dados pessoais."
    : "Quero ajuda da equipe do portal.";
  return {
    mode: "managed",
    service: "Outro serviço",
    initialProblem: request + " Estou na " + page + " do Encontre um Técnico. ",
  };
}

/** Opens the existing private admin contact form, not a technician contact. */
export function openFreeHelp(context: FreeHelpContext = {}) {
  if (typeof window === "undefined") return;
  // Capture only the origin path: queries, fragments and descriptions never
  // become attribution or analytics. Keep this snapshot during the dialog.
  const detail = { ...context, sourcePath: window.location.pathname,
    placement: clean(context.placement) || "contextual-cta" };
  window.dispatchEvent(new CustomEvent<FreeHelpContext>("eut-open-free-help", { detail }));
}
