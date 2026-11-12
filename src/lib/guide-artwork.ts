/** Ilustrações originais e locais por categoria, sem requisições externas. */
export const GUIDE_ARTWORK = {
  automacao: {
    src: "/servicos/automacao-ambientes-integrados.svg",
    alt: "Ilustração original de automação com ambientes, controlador e acesso protegido",
  },
  comunicacoes: {
    src: "/servicos/interfonia-telefonia-ip.svg",
    alt: "Ilustração original de interfonia, rede de comunicação e ramais de telefonia IP",
  },
  computadores: {
    src: "/guias/computador-diagnostico-ilustrado.svg",
    alt: "Ilustração de bancada de manutenção com computador, monitor e ferramentas",
  },
  cftv: {
    src: "/guias/cftv-planejamento-ilustrado.svg",
    alt: "Ilustração de câmeras, zonas de cobertura, cabeamento e gravador de imagens",
  },
  redes: {
    src: "/guias/wifi-instabilidade-cobertura-ilustrado.svg",
    alt: "Ilustração de uma casa com roteador Wi-Fi, ondas de sinal e dispositivos conectados",
  },
  impressoras: {
    src: "/guias/impressora-offline-fila-ilustrado.svg",
    alt: "Ilustração de impressora com documento, fila de impressão e verificação de conexão",
  },
  software: {
    src: "/guias/backup-seguro-manutencao-ilustrado.svg",
    alt: "Ilustração de notebook com documentos, cópia para armazenamento separado e verificação de backup",
  },
  climatizacao: {
    src: "/guias/ar-condicionado-nao-gela-ilustrado.svg",
    alt: "Ilustração de aparelho de ar-condicionado, circulação de ar e termômetro para avaliação segura",
  },
} as const;

export function getGuideArtwork(categorySlug: string) {
  return GUIDE_ARTWORK[categorySlug as keyof typeof GUIDE_ARTWORK] ?? GUIDE_ARTWORK.computadores;
}
/**
 * Exact curated illustration for a real category, never the fallback image
 * used by editorial guide pages. Unknown/private slugs return no artwork.
 */
export function getExactGuideArtwork(categorySlug: string): (typeof GUIDE_ARTWORK)[keyof typeof GUIDE_ARTWORK] | null {
  return Object.prototype.hasOwnProperty.call(GUIDE_ARTWORK, categorySlug)
    ? GUIDE_ARTWORK[categorySlug as keyof typeof GUIDE_ARTWORK]
    : null;
}

/** Illustrations of declared service topics, NOT a technician's work gallery. */
export function getDeclaredServiceIllustrations(specialties: readonly string[], limit = 3) {
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(0, Math.min(3, limit)) : 0;
  return [...new Set(specialties)]
    .flatMap(slug => {
      const artwork = getExactGuideArtwork(slug);
      return artwork ? [{ slug, ...artwork }] : [];
    })
    .slice(0, safeLimit);
}
