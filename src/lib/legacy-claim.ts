/**
 * Solicitação de revisão de um perfil antigo, sem vinculação automática.
 * Nunca use a referência informada como prova de titularidade.
 */
export const LEGACY_CLAIM_SUBJECT = "Reivindicação de cadastro histórico";

const KNOWN_ORIGINS = new Set([
  "encontreumtecnico.com",
  "www.encontreumtecnico.com",
  "precisodeumtecnico.com",
  "www.precisodeumtecnico.com",
]);

export function normalizeLegacyReference(value: string): string | null {
  const input = value.trim();
  if (/^[1-9]\d{0,11}$/.test(input)) return "ID WordPress: " + input;
  if (!input || input.length > 250) return null;
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      !KNOWN_ORIGINS.has(url.hostname.toLowerCase()) ||
      url.username || url.password || url.port
    ) return null;
    const path = url.pathname.replace(/\/+/g, "/").replace(/\/$/, "");
    if (!path || path === "/") return null;
    return "URL: " + url.origin + path;
  } catch {
    return null;
  }
}

export function formatLegacyClaim(reference: string, note: string): string | null {
  const canonical = normalizeLegacyReference(reference);
  if (!canonical) return null;
  const safeNote = note.trim().replace(/[\r\n]+/g, " ").slice(0, 650);
  return [
    "PEDIDO DE VÍNCULO LEGADO — SOMENTE TRIAGEM",
    canonical,
    safeNote ? "Observação do solicitante: " + safeNote : "Sem observações adicionais.",
    "Não vincular ou publicar sem verificar titularidade por canal independente.",
  ].join("\n");
}
