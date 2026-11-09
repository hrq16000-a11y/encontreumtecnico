import { CATEGORIES } from "./categories";

/** Compatibilidade com URLs da prévia TanStack antiga, não com identidades WordPress. */
export type LegacyGallerySearch = { q?: unknown; city?: unknown };
export type NewDirectorySearch = { especialidade: string; cidade: string; regiao: string };

const normalizeQuery = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[<>\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
    : "";

const unaccent = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const aliases: Record<string, (typeof CATEGORIES)[number]> = {
  "ar condicionado": "Ar-condicionado",
  "ar-condicionado": "Ar-condicionado",
  "automacao": "Automação",
  "cftv": "CFTV",
  "camera": "CFTV",
  "cameras": "CFTV",
  "vigilancia": "CFTV",
  "notebook": "Computador",
  "laptop": "Computador",
  "desktop": "Computador",
  "computador": "Computador",
  "pc": "Computador",
  "informatica": "Computador",
  "formatacao": "Computador",
  "redes": "Comunicações",
  "rede": "Comunicações",
  "wi-fi": "Comunicações",
  "wifi": "Comunicações",
  "cabeamento": "Comunicações",
  "comunicacoes": "Comunicações",
  "eletrica": "Elétrica",
  "grafica": "Gráfica",
  "impressora": "Impressora",
  "impressoras": "Impressora",
};

/** Preserva cidade e converte apenas categorias conhecidas. Não inventa resultados. */
export function mapLegacyGallerySearch(search: LegacyGallerySearch): NewDirectorySearch {
  const query = unaccent(normalizeQuery(search.q));
  const recognized = CATEGORIES.find((name) => unaccent(name) === query);
  return {
    especialidade: recognized ?? aliases[query] ?? "Todas",
    cidade: normalizeQuery(search.city),
    regiao: "",
  };
}
