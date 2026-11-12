/**
 * Curated ORIGINAL editorial illustrations already shipped with this portal.
 * Never derive a media filename from an untrusted category slug. A category
 * without a relevant illustration uses the generic service icon instead.
 * These drawings illustrate service topics, not real technician identities.
 */
export const PUBLIC_CATEGORY_ILLUSTRATIONS: Readonly<Record<string, string>> = Object.freeze({
  climatizacao: "/guias/ar-condicionado-nao-gela-ilustrado.svg",
  automacao: "/servicos/automacao-ambientes-integrados.svg",
  cftv: "/guias/cftv-planejamento-ilustrado.svg",
  computadores: "/guias/computador-diagnostico-ilustrado.svg",
  software: "/guias/backup-seguro-manutencao-ilustrado.svg",
  comunicacoes: "/servicos/interfonia-telefonia-ip.svg",
  redes: "/guias/wifi-instabilidade-cobertura-ilustrado.svg",
  impressoras: "/guias/impressora-offline-fila-ilustrado.svg",
});

export function getPublicCategoryIllustration(slug: string): string | null {
  return PUBLIC_CATEGORY_ILLUSTRATIONS[slug] ?? null;
}
