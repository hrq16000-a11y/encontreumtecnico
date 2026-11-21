import type { ActiveCategory } from "@/hooks/use-active-categories";
import type { ActiveService } from "@/hooks/use-active-services";
import type { ServiceCategory } from "@/lib/service-catalog";

/** Only named choices already present in the help funnel; each slug belongs
 * to the canonical public category contract. Never slugify free-form input. */
const FUNNEL_CATEGORY_CHOICES: Readonly<Record<string, ServiceCategory["slug"]>> = {
  "Computadores e notebooks": "computadores",
  "Redes e Wi-Fi": "redes",
  "CFTV e segurança": "cftv",
  "Impressoras": "impressoras",
  "Sistemas e software": "software",
  "Climatização": "climatizacao",
  "Automação": "automacao",
  "Comunicações e telefonia": "comunicacoes",
};

type DirectoryFilters = { especialidade: string; servico: string };

const fold = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR").trim();

/** A directory filter must exist in the live, active public catalog.
 * Unknown text stays in the saved request but is never used as a fabricated
 * category/service slug in /tecnicos. */
export function assistanceDirectoryFilters(
  selected: string,
  categories: readonly Pick<ActiveCategory, "slug" | "label">[],
  services: readonly Pick<ActiveService, "slug" | "category_slug" | "label">[],
): DirectoryFilters {
  const fallback: DirectoryFilters = { especialidade: "Todas", servico: "" };
  const value = selected.trim();
  if (!value) return fallback;

  const knownCategory = FUNNEL_CATEGORY_CHOICES[value];
  const activeCategory = categories.find(category =>
    category.slug === (knownCategory ?? value) ||
    (!knownCategory && fold(category.label) === fold(value)));
  if (activeCategory) return { especialidade: activeCategory.slug, servico: "" };

  // Preserve a specific service only after checking the exact slug or label
  // against the active service catalog and its active parent category.
  const matches = services.filter(service =>
    (service.slug === value || fold(service.label) === fold(value)) &&
    categories.some(category => category.slug === service.category_slug));
  if (matches.length !== 1) return fallback;
  return { especialidade: matches[0]!.category_slug, servico: matches[0]!.slug };
}
