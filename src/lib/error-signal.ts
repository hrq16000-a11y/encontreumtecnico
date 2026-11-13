// Deliberately low-cardinality diagnostics: no URLs, query strings, slugs,
// identities, phone numbers, error messages or stack traces leave the browser.
export const ERROR_SIGNAL_KINDS = ["route_error", "window_error", "unhandled_rejection"] as const;
export const ERROR_SIGNAL_AREAS = ["home", "catalogo", "atendimento", "admin", "conta", "outras"] as const;
export const ERROR_SIGNAL_STATUSES = [403, 500, 503] as const;

export type ErrorSignal = {
  kind: (typeof ERROR_SIGNAL_KINDS)[number];
  area: (typeof ERROR_SIGNAL_AREAS)[number];
  status: (typeof ERROR_SIGNAL_STATUSES)[number];
};

export function errorSignalArea(pathname: string): ErrorSignal["area"] {
  if (pathname === "/" || pathname === "/home2") return "home";
  if (/^\/(tecnicos|tecnico|galeria)(\/|$)/.test(pathname)) return "catalogo";
  if (/^\/(contato|area-cliente|acesso-contato)(\/|$)/.test(pathname)) return "atendimento";
  if (/^\/admin(\/|$)/.test(pathname)) return "admin";
  if (/^\/(entrar|cadastro|area-tecnico|redefinir-senha)(\/|$)/.test(pathname)) return "conta";
  return "outras";
}

export function parseErrorSignal(value: unknown): ErrorSignal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = Object.keys(value);
  if (fields.length !== 3 || !fields.every(field => ["kind", "area", "status"].includes(field))) return null;
  const { kind, area, status } = value as Record<string, unknown>;
  if (!ERROR_SIGNAL_KINDS.includes(kind as ErrorSignal["kind"]) ||
      !ERROR_SIGNAL_AREAS.includes(area as ErrorSignal["area"]) ||
      !ERROR_SIGNAL_STATUSES.includes(status as ErrorSignal["status"])) return null;
  return { kind: kind as ErrorSignal["kind"], area: area as ErrorSignal["area"], status: status as ErrorSignal["status"] };
}

const sentSignals = new Set<string>();

export function emitErrorSignal(kind: ErrorSignal["kind"], status: ErrorSignal["status"] = 500) {
  if (typeof window === "undefined") return;
  const signal: ErrorSignal = { kind, status, area: errorSignalArea(window.location.pathname) };
  const key = `${signal.kind}:${signal.status}:${signal.area}`;
  // No cookies/storage; cap both duplicates and outgoing traffic in this page lifecycle.
  if (sentSignals.has(key) || sentSignals.size >= 3) return;
  sentSignals.add(key);
  try {
    void fetch("/api/error-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      keepalive: true,
      body: JSON.stringify(signal),
    }).catch(() => {});
  } catch {
    // Diagnostics must never interfere with the user's navigation or retry.
  }
}

export function installErrorSensor() {
  if (typeof window === "undefined") return () => {};
  const onError = () => emitErrorSignal("window_error");
  const onRejection = () => emitErrorSignal("unhandled_rejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
