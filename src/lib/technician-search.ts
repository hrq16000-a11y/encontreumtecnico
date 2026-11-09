/** Normaliza filtros do diretório, sem interpretar campos como URLs ou SQL. */
export function normalizeTechnicianSearch(search: Record<string, unknown>) {
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim().slice(0, 100) : "";
  return {
    especialidade: text(search.especialidade),
    cidade: text(search.cidade),
  };
}
