/** Editorial illustrations are local, tiny SVGs: one image per guide, no external requests. */
export const GUIDE_ARTWORK = {
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
