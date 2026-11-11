import { useEffect, useState } from "react";
import { readUiTextDraft, saveUiTextDraft } from "@/lib/unsent-ui-draft";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { triageProblem, type TriageResult } from "../lib/problem-triage.functions";
import { saveTriageDraft } from "../lib/triage-draft";

export function ProblemAssistant() {
  const navigate = useNavigate();
  const triage = useServerFn(triageProblem);
  const [description, setDescription] = useState(() => readUiTextDraft("problem")?.["description"] ?? "");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveUiTextDraft("problem", { description });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [description]);
  const [result, setResult] = useState<TriageResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setResult({ ok: false, error: "Descreva o problema com pelo menos 10 caracteres." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await triage({ data: { description } });
      setResult(r);
      if (r.ok) window.__lovableEvents?.track?.("project.problem_triaged", { category: r.category });
    } catch {
      setResult({ ok: false, error: "Não foi possível analisar o problema agora. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    if (!result?.ok) return;
    saveTriageDraft({ description, category: result.category, city: result.city, region: result.region });
    navigate({
      to: "/tecnicos",
      search: { especialidade: result.category, cidade: result.city, regiao: result.region },
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-card-foreground">Descreva seu problema</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Conte o que está acontecendo e sugerimos a categoria de serviço e os filtros de busca.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label htmlFor="descricao-problema" className="sr-only">Descrição do problema</label>
        <textarea
          id="descricao-problema"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Ex.: Meu notebook não liga desde ontem, moro em Campinas, no Cambuí."
          className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Analisando…" : "Sugerir categoria"}
        </button>
      </form>

      {result && !result.ok && <p role="alert" className="mt-4 text-sm text-destructive">{result.error}</p>}
      {result?.ok && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="text-foreground">
            Categoria sugerida: <strong>{result.category}</strong>
          </p>
          <p className="mt-1 text-muted-foreground">{result.reason}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.city && <li className="rounded-full bg-muted px-3 py-1 text-xs">Cidade: {result.city}</li>}
            {result.region && <li className="rounded-full bg-muted px-3 py-1 text-xs">Região: {result.region}</li>}
            {result.keywords.map((k) => (
              <li key={k} className="rounded-full bg-muted px-3 py-1 text-xs">{k}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={applyFilters}
            className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Buscar técnicos com esses filtros
          </button>
        </div>
      )}
    </div>
  );
}
