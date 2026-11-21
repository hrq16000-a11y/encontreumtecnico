import type { ActiveCategory } from "@/hooks/use-active-categories";

type Category = Pick<ActiveCategory, "slug" | "label">;

/** A Home category may be submitted only if the public catalog reports it active.
 * Old free-text drafts and missing catalogs safely fall back to unfiltered search.
 */
export function canonicalHomeCategory(value: string, categories: readonly Category[]): string {
  return categories.some((category) => category.slug === value) ? value : "Todas";
}

export function HomeCategoryPicker({
  value, categories, loading, error, onChange,
}: {
  value: string;
  categories: readonly Category[];
  loading: boolean;
  error: boolean;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="w-full min-w-0 sm:flex-1">
      <label htmlFor="busca-especialidade" className="sr-only">Especialidade</label>
      <select
        id="busca-especialidade"
        aria-describedby="home-category-instructions"
        value={canonicalHomeCategory(value, categories)}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className="h-11 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
      >
        <option value="Todas">{loading ? "Carregando especialidades…" : "Todas as especialidades"}</option>
        {categories.map((category) => (
          <option key={category.slug} value={category.slug}>{category.label}</option>
        ))}
      </select>
      <p id="home-category-instructions" className="sr-only">
        Escolha uma categoria ativa. Os serviços específicos podem ser refinados na lista de técnicos.
      </p>
      {error && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          Categorias indisponíveis. Você ainda pode buscar por município.
        </p>
      )}
    </div>
  );
}
