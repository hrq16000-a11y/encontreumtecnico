export type CatalogDraft = {
  kind: "category" | "service";
  slug: string;
  label: string;
  description: string;
  displayOrder: string;
  categorySlug: string;
};

type CatalogChanges = {
  label: string;
  description: string;
  display_order: number;
  category_slug?: string;
};

export function validateCatalogDraft(
  draft: CatalogDraft,
  activeCategorySlugs: readonly string[],
): { changes: CatalogChanges; error: null } | { changes: null; error: string } {
  const label = draft.label.trim();
  const description = draft.description.trim();
  const maxLabel = draft.kind === "category" ? 100 : 120;

  if (label.length < 3 || label.length > maxLabel) {
    return { changes: null, error: `O nome deve ter entre 3 e ${maxLabel} caracteres.` };
  }
  if (description.length > 500) {
    return { changes: null, error: "A descrição deve ter no máximo 500 caracteres." };
  }
  if (!/^(0|[1-9]\d*)$/.test(draft.displayOrder.trim())) {
    return { changes: null, error: "A posição deve ser um número inteiro não negativo." };
  }
  const displayOrder = Number(draft.displayOrder.trim());
  if (!Number.isSafeInteger(displayOrder) || displayOrder > 9999) {
    return { changes: null, error: "A posição deve estar entre 0 e 9999." };
  }

  const changes: CatalogChanges = { label, description, display_order: displayOrder };
  if (draft.kind === "service") {
    if (!activeCategorySlugs.includes(draft.categorySlug)) {
      return { changes: null, error: "Selecione uma categoria ativa para o serviço." };
    }
    changes.category_slug = draft.categorySlug;
  }
  return { changes, error: null };
}

export function catalogWriteError(
  expectedSlug: string,
  result: { data: { slug: string } | null; error: { message: string } | null },
): { message: string } | null {
  if (result.error) return result.error;
  if (result.data?.slug === expectedSlug) return null;
  return { message: "Registro não alterado: permissões insuficientes ou edição concorrente." };
}
