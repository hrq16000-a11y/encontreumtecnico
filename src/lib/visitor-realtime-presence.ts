/** Ephemeral public Realtime channel. Never publish a user ID, IP, path or location. */
export const CONSENTED_VISITOR_CHANNEL = "eut-consented-visitor-tabs-v1";
export const CONSENTED_VISITOR_KIND = "consented-visitor-tab";

export function canShareAnonymousPresence(pathname: string, consent: string | null): boolean {
  // A past analytics acceptance is not consent to this newer purpose.
  try { if (consent === null || JSON.parse(consent).presence !== true) return false; }
  catch { return false; }
  // Private workspaces are never counted as visits to the public portal.
  return !/^\/(?:admin|area-tecnico|area-cliente|entrar|acesso-contato|redefinir-senha|ajuda-acesso|reivindicar-cadastro|lp2\/(?:admin|admin-portal|entrar|meu-perfil|acompanhar|clientes|atividades|cliente))(?:\/|$)/.test(pathname);
}

/** Count active connections, not people. Ignore any unrecognized payloads. */
export function countConsentedVisitorTabs(state: Record<string, unknown>): number {
  return Object.values(state).reduce<number>((total, entries) => {
    if (!Array.isArray(entries)) return total;
    return total + (entries.some((entry) =>
      entry !== null && typeof entry === "object" &&
      (entry as Record<string, unknown>)["kind"] === CONSENTED_VISITOR_KIND) ? 1 : 0);
  }, 0);
}
