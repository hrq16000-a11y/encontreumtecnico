import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLivePresence } from "@/components/admin-live-presence";

const db = supabase as unknown as SupabaseClient;
type RecentSearch = {
  category: string;
  city: string;
  region: string;
  result_count: number;
  created_at: string;
};
type ActivitySnapshot = {
  fiveMinutes: number;
  thirtyMinutes: number;
  recent: RecentSearch[];
  checkedAt: Date;
};
type Period = 5 | 30;

function readableDate(raw: string): string {
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Horário indisponível";
}

/** Metadata only. The existing search_events RLS permits SELECT only for admins. */
export async function readRecentSearchActivity(now = new Date()): Promise<ActivitySnapshot> {
  const five = new Date(now.getTime() - 5 * 60_000).toISOString();
  const thirty = new Date(now.getTime() - 30 * 60_000).toISOString();
  const [fiveResult, thirtyResult, recentResult] = await Promise.all([
    db.from("search_events").select("id", { count: "exact", head: true }).gte("created_at", five),
    db.from("search_events").select("id", { count: "exact", head: true }).gte("created_at", thirty),
    db.from("search_events").select("category,city,region,result_count,created_at")
      .gte("created_at", thirty).order("created_at", { ascending: false }).limit(12),
  ]);
  if (fiveResult.error || thirtyResult.error || recentResult.error ||
      typeof fiveResult.count !== "number" || typeof thirtyResult.count !== "number" ||
      !Array.isArray(recentResult.data)) {
    throw new Error("Não foi possível consultar a atividade consentida.");
  }
  return {
    fiveMinutes: fiveResult.count,
    thirtyMinutes: thirtyResult.count,
    recent: recentResult.data.filter((row): row is RecentSearch =>
      typeof row === "object" && row !== null && typeof row.category === "string" &&
      typeof row.city === "string" && typeof row.region === "string" &&
      typeof row.result_count === "number" && typeof row.created_at === "string"),
    checkedAt: now,
  };
}

export function AdminVisitorActivity() {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null);
  const [period, setPeriod] = useState<Period>(30);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      setBusy(true);
      try {
        const next = await readRecentSearchActivity();
        if (active) { setSnapshot(next); setError(""); }
      } catch {
        if (active) { setSnapshot(null); setError("Atividade indisponível ou sem permissão de consulta."); }
      } finally { if (active) setBusy(false); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [revision]);

  const cutoff = snapshot ? snapshot.checkedAt.getTime() - period * 60_000 : 0;
  const normalized = query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const recent = (snapshot?.recent ?? []).filter((row) => {
    if (new Date(row.created_at).getTime() < cutoff) return false;
    if (!normalized) return true;
    return `${row.category} ${row.city} ${row.region}`.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(normalized);
  });

  return <><AdminLivePresence /><section aria-label="Atividade recente de buscas consentidas" className="mt-7 rounded-xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground"><Activity className="h-5 w-5 text-primary" /> Atividade recente no portal</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Buscas registradas por visitantes que aceitaram analytics. Não representam visitantes únicos ou pessoas online.
          Não armazenamos identidade, IP ou localização precisa neste registro.
        </p>
      </div>
      <button type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold disabled:opacity-50">
        <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
      </button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {([{ label: "Buscas nos últimos 5 min", count: snapshot?.fiveMinutes },
        { label: "Buscas nos últimos 30 min", count: snapshot?.thirtyMinutes }] as const).map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <strong className="mt-2 block text-3xl font-bold tabular-nums">{typeof item.count === "number" ? item.count.toLocaleString("pt-BR") : "—"}</strong>
        </div>
      ))}
    </div>
    <div className="mt-5 flex flex-wrap gap-3">
      <label className="grid min-w-[130px] flex-1 gap-1 text-sm font-semibold">Período
        <select value={period} onChange={(event) => setPeriod(Number(event.target.value) as Period)}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
          <option value={5}>Últimos 5 minutos</option><option value={30}>Últimos 30 minutos</option>
        </select>
      </label>
      <label className="grid min-w-[180px] flex-[2] gap-1 text-sm font-semibold">Filtrar por serviço ou localidade informada
        <input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))}
          placeholder="Categoria, cidade ou região" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm" />
      </label>
    </div>
    {snapshot && <p role="status" className="mt-3 text-xs text-muted-foreground">
      Atualizado às {snapshot.checkedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
      A consulta atualiza a cada 30 segundos enquanto esta aba estiver visível.
    </p>}
    {snapshot && (recent.length ? <ul className="mt-4 grid gap-2" aria-label="Últimas buscas registradas">
      {recent.map((row, index) => <li key={`${row.created_at}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
        <span className="min-w-0 break-words"><strong>{row.category || "Todas"}</strong>
          {row.city ? ` · ${row.city}` : ""}{row.region ? ` · ${row.region}` : ""}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{readableDate(row.created_at)} · {row.result_count} resultado(s)</span>
      </li>)}
    </ul> : <p className="mt-4 text-sm text-muted-foreground">Nenhuma busca consentida corresponde ao período e aos filtros.</p>)}
    <p className="mt-4 text-xs text-muted-foreground">
      A lista exibe até 12 buscas recentes; os contadores consultam o total real do período. Não há rastreamento individual de sessões.
    </p>
  </section></>;
}
