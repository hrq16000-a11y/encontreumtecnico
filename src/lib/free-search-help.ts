export type FreeHelpContext = {
  city?: string;
  uf?: string;
  neighborhood?: string;
  service?: string;
  technicianId?: string;
  technicianName?: string;
  mode?: "direct" | "managed";
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

/** Opens the existing private admin contact form, not a technician contact. */
export function openFreeHelp(context: FreeHelpContext = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FreeHelpContext>("eut-open-free-help", { detail: context }));
}
