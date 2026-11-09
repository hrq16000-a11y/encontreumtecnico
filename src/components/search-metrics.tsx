import { useEffect, useState } from "react";
import { z } from "zod";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { metricsSchema } from "@/lib/search-analytics";

export function SearchMetrics() {
  const [metrics, setMetrics] = useState<z.infer<typeof metricsSchema> | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError(false);
    try {
      const response = await supabase.rpc("admin_search_metrics");
      if (response.error) throw response.error;
      setMetrics(metricsSchema.parse(response.data));
    } catch { setError(true); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  const groups = metrics ? [
    { title: "Categorias", rows: metrics.categories },
    { title: "Cidades", rows: metrics.cities },
    { title: "Filtros utilizados", rows: metrics.filters.map(r => ({ ...r, label: ({ especialidade: "Especialidade", cidade: "Cidade", regiao: "Região" } as Record<string, string>)[r.label] ?? r.label })) },
  ] : [];
  return <section className="mt-10 border-t border-border pt-8" aria-label="Estatísticas de buscas">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Buscas nos últimos 30 dias</h2><p className="text-sm text-muted-foreground">{metrics ? `${metrics.total} buscas registradas com consentimento` : "Carregando…"}</p></div>
      <Button variant="outline" size="icon" title="Atualizar gráficos" aria-label="Atualizar gráficos" disabled={busy} onClick={() => void load()}><RefreshCw className={busy ? "animate-spin" : ""} /></Button>
    </div>
    {error && <p role="alert" className="mt-4 text-destructive">Não foi possível carregar os gráficos. Tente atualizar.</p>}
    <div className="mt-6 grid gap-8 md:grid-cols-3">{groups.map(group => <div key={group.title}>
      <h3 className="font-semibold">{group.title}</h3>
      {group.rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Ainda sem buscas neste período.</p> : <ul className="mt-4 space-y-4">{group.rows.map(row => <li key={row.label}>
        <div className="mb-1 flex justify-between gap-2 text-sm"><span className="min-w-0 break-words">{row.label}</span><span className="shrink-0 tabular-nums">{row.value}</span></div>
        <progress className="search-progress block h-2 w-full" aria-label={row.label} value={row.value} max={Math.max(...group.rows.map(r => r.value), 1)} />
      </li>)}</ul>}
    </div>)}</div>
  </section>;
}