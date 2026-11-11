import { GUIDES, type PublicGuide } from "./public-guides";

/** Stable public service taxonomy. Do not invent professionals or categories from user text. */
export const SERVICE_CATEGORIES = [
  { slug: "climatizacao", name: "Climatização", description: "Instalação e manutenção de ar-condicionado. Informe o modelo, a necessidade e o ambiente de atendimento." },
  { slug: "automacao", name: "Automação", description: "Sensores, controles e automação residencial ou comercial. Descreva os dispositivos e a integração desejada." },
  { slug: "cftv", name: "Câmeras e segurança eletrônica", description: "Instalação de câmeras, gravadores, monitoramento e configuração de acesso remoto." },
  { slug: "computadores", name: "Computadores e notebooks", description: "Diagnóstico, montagem, atualização e reparos. Informe os sintomas e os equipamentos." },
  { slug: "comunicacoes", name: "Comunicações e telefonia", description: "Interfonia e telefonia IP. Consulte os serviços específicos informados pelo prestador." },
  { slug: "eletrica", name: "Elétrica", description: "Instalações e reparos elétricos. Confirme a habilitação técnica adequada antes de contratar." },
  { slug: "design-grafico", name: "Serviços gráficos", description: "Artes e serviços gráficos. Confira o escopo declarado por cada profissional." },
  { slug: "impressoras", name: "Impressoras", description: "Configuração de impressoras, rede e manutenção. Informe a marca, o modelo e a falha." },
  { slug: "redes", name: "Redes e conectividade", description: "Configuração de Wi-Fi, roteadores e rede cabeada. Explique o ambiente e os pontos afetados." },
  { slug: "software", name: "Sistemas e software", description: "Instalação de programas, backup, formatação e limpeza de vírus. Proteja dados importantes antes da intervenção." },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** Six original articles are repurposed as complete content *inside* their specialty pages. */
export function getEnrichedServiceCategory(slug: string): { category: ServiceCategory; guide: PublicGuide } | null {
  const category = SERVICE_CATEGORIES.find(item => item.slug === slug);
  if (!category) return null;
  const guide = GUIDES.find(item => item.categorySlug === category.slug);
  return guide ? { category, guide } : null;
}

/** Only create indexable editorial category pages for real, non-thin content. */
export const ENRICHED_CATEGORY_PATHS = SERVICE_CATEGORIES
  .filter(category => getEnrichedServiceCategory(category.slug) !== null)
  .map(category => "/servicos/" + category.slug);
