export const CATALOG_CATEGORIES = [
  "computadores", "software", "redes", "impressoras", "cftv",
  "automacao", "eletrica", "climatizacao", "comunicacoes", "design-grafico",
] as const;

export type LocalTriage = {
  ok: true;
  category: string;
  reason: string;
  city: string;
  region: string;
  keywords: string[];
};

const normalized = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const SIGNALS: Record<(typeof CATALOG_CATEGORIES)[number], string[]> = {
  computadores: ["computador", "notebook", "laptop", "pc", "hardware", "placa mae", "memoria ram", "nao liga", "tela azul"],
  software: ["windows", "formatar", "formatacao", "sistema operacional", "virus", "malware", "instalar programa", "software", "aplicativo", "backup"],
  redes: ["internet", "wi-fi", "wifi", "roteador", "rede sem fio", "fibra optica", "conectividade", "cabeamento", "switch"],
  impressoras: ["impressora", "impressao", "toner", "cartucho", "scanner", "multifuncional", "xerox"],
  cftv: ["camera de seguranca", "cameras", "cftv", "dvr", "nvr", "monitoramento", "alarme", "videoporteiro"],
  automacao: ["automacao", "casa inteligente", "smart home", "sensor inteligente", "controle remoto automatico"],
  eletrica: ["eletrica", "eletricista", "tomada", "disjuntor", "fiacao", "curto circuito", "quadro de energia", "lampada"],
  climatizacao: ["ar condicionado", "split", "climatizacao", "refrigeracao", "ventilacao", "evaporadora", "condensadora"],
  comunicacoes: ["telefonia", "telefone fixo", "pabx", "interfone", "ramal", "voip", "comunicacoes"],
  "design-grafico": ["design grafico", "arte final", "identidade visual", "banner", "panfleto", "logotipo", "grafica"],
};

const ALIASES: Record<string, string> = {
  "ar-condicionado": "climatizacao", automacao: "automacao", cftv: "cftv",
  computador: "computadores", comunicacoes: "comunicacoes", eletrica: "eletrica",
  grafica: "design-grafico", impressora: "impressoras",
};

export function categorySlug(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const key = normalized(input.trim());
  if ((CATALOG_CATEGORIES as readonly string[]).includes(key)) return key;
  return ALIASES[key] ?? null;
}

// No GPS/IP inference: these values must be explicitly present in the client's text.
export function extractDeclaredLocation(description: string): { city: string; region: string } {
  const cityMatch = description.match(
    /(?:moro\s+em|na\s+cidade\s+de|cidade\s*:|(?:estou|fica|atendimento)\s+em)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '-]{1,65}?)(?=[,.;]|\s+(?:no\s+bairro|na\s+regi[aã]o|e\s+(?:preciso|quero|estou)|com\s+|para\s+)|$)/i,
  );
  const neighborhoodMatch = description.match(
    /(?:no\s+bairro|bairro\s*:|na\s+regi[aã]o\s+de)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '-]{1,55}?)(?=[,.;]|\s+(?:e\s+|com\s+|para\s+)|$)/i,
  );
  return {
    city: cityMatch?.[1]?.trim().slice(0, 80) ?? "",
    region: neighborhoodMatch?.[1]?.trim().slice(0, 80) ?? "",
  };
}

export function triageLocally(description: string): LocalTriage {
  const words = normalized(description);
  const ranked = CATALOG_CATEGORIES.map((category, order) => ({
    category,
    order,
    matches: SIGNALS[category].filter((signal) =>
      new RegExp("(^|[^a-z0-9])" + normalized(signal) + "([^a-z0-9]|$)").test(words),
    ),
  })).sort((a, b) => b.matches.length - a.matches.length || a.order - b.order);
  const best = ranked[0];
  const hasMatch = best.matches.length > 0;
  const location = extractDeclaredLocation(description);
  return {
    ok: true,
    category: hasMatch ? best.category : "Todas",
    reason: hasMatch
      ? "Categoria sugerida pelas palavras do problema. Confirme os filtros antes de escolher o profissional."
      : "Não identificamos uma especialidade com segurança. Mostramos todas as categorias para você escolher.",
    city: location.city,
    region: location.region,
    keywords: hasMatch ? best.matches.slice(0, 4) : [],
  };
}
