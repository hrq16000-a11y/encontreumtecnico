import type { PublicGuide } from "./public-guides";
import type { ServiceCategory } from "./service-catalog";

const GUIDE_SERVICE_LABELS: Record<ServiceCategory["slug"], string> = {
  cftv: "CFTV e segurança",
  computadores: "Computadores e notebooks",
  redes: "Redes e Wi-Fi",
  impressoras: "Impressoras",
  software: "Sistemas e software",
  climatizacao: "Climatização",
  automacao: "Automação",
  comunicacoes: "Comunicações e telefonia",
  eletrica: "Elétrica",
  "design-grafico": "Serviços gráficos",
};

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
  /** Stable public CTA intent, never user-entered text or contact data. */
  draftScope?: `portal-${"home" | "contato"}-${"geral" | "privacidade"}` | `service-${ServiceCategory["slug"]}`;
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
    draftScope: `portal-${source}-${reason}`,
    service: "Outro serviço",
    initialProblem: request + " Estou na " + page + " do Encontre um Técnico. ",
  };
}

/** Use the same category-scoped draft from the service page, guide and FAQ.
 * Only known taxonomy keys may become storage scopes; unknown guides retain their existing fallback.
 */
export function guideHelpContext(guide: Pick<PublicGuide, "slug" | "categorySlug" | "categoryName">): FreeHelpContext {
  const category = guide.categorySlug;
  const known = Object.prototype.hasOwnProperty.call(GUIDE_SERVICE_LABELS, category);
  const slug = category as ServiceCategory["slug"];
  return {
    mode: "managed",
    guideSlug: guide.slug,
    service: known ? GUIDE_SERVICE_LABELS[slug] : guide.categoryName,
    ...(known ? { draftScope: `service-${slug}` as const } : {}),
  };
}

/** Opens the existing private admin contact form, not a technician contact. */
export function openFreeHelp(context: FreeHelpContext = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FreeHelpContext>("eut-open-free-help", { detail: context }));
}
