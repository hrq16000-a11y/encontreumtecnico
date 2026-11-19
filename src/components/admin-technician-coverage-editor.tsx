import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { publicTextProblem } from "@/lib/public-profile-text";

const db = supabase as unknown as SupabaseClient;
const field = "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
type City = { id: number; name: string; uf: string };

export function AdminTechnicianCoverageEditor({ technicianId, onSaved }: {
  technicianId: string; onSaved: (message: string) => void;
}) {
  const [revision, setRevision] = useState<string | null>(null);
  const [uf, setUf] = useState("");
  const [entireUf, setEntireUf] = useState(false);
  const [notes, setNotes] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<City[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      const { data, error: rpcError } = await db.rpc("eut_admin_technician_coverage", {
        _technician_id: technicianId, _payload: null,
      });
      if (rpcError || data?.ok !== true || !Array.isArray(data.coverage_city_ids)) throw new Error();
      const ids = data.coverage_city_ids as number[];
      const result = ids.length ? await db.from("eut_ibge_municipalities")
        .select("id,name,uf").in("id", ids.slice(0, 100)) : { data: [], error: null };
      if (result.error || result.data?.length !== ids.length) throw new Error();
      if (!live) return;
      setRevision(data.updated_at);
      setUf(data.declared_uf ?? "");
      setEntireUf(data.covers_entire_uf === true);
      setNotes(data.coverage_notes ?? "");
      setCities(result.data as City[]);
    }
    void load().catch(() => { if (live) setError("Não foi possível carregar as regiões cadastradas."); });
    return () => { live = false; };
  }, [technicianId]);

  useEffect(() => {
    if (search.trim().length < 3) { setMatches([]); return; }
    let live = true;
    const timer = window.setTimeout(() => {
      const safe = search.trim().replace(/[%_*,()\\]/g, " ").slice(0, 80);
      void db.from("eut_ibge_municipalities").select("id,name,uf")
        .ilike("name", `%${safe}%`).order("name").limit(12)
        .then(({ data, error: searchError }) => {
          if (live) setMatches(searchError ? [] : (data ?? []) as City[]);
        });
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [search]);

  async function save() {
    if (busy || !revision) return;
    setError(null);
    if (reason.trim().length < 8 || reason.trim().length > 400 || publicTextProblem(reason, "identity") ||
      notes.length > 400 || publicTextProblem(notes, "identity") || (entireUf && !uf)) {
      setError("Revise a UF, as observações e a justificativa (8–400 caracteres, sem contatos)."); return;
    }
    setBusy(true);
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_technician_coverage", {
        _technician_id: technicianId,
        _expected_updated_at: revision,
        _payload: { city_ids: cities.map((city) => city.id), declared_uf: uf || null,
          covers_entire_uf: entireUf, coverage_notes: notes.trim() || null },
        _reason: reason.trim(),
      });
      if (rpcError || data?.ok !== true) throw new Error();
      onSaved("Regiões atendidas salvas com auditoria.");
    } catch { setError("Não foi possível gravar a cobertura. Reabra a ficha se outro administrador a alterou."); }
    finally { setBusy(false); }
  }

  return <section aria-label="Regiões atendidas" className="grid gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:p-4">
    <h4 className="font-bold text-foreground">Regiões atendidas</h4>
    <p className="text-xs text-muted-foreground">Edite os municípios declarados pelo técnico, independentemente da origem ou de reivindicação do cadastro.</p>
    <label className="grid gap-1 text-sm font-semibold text-foreground">UF de referência
      <select className={field} value={uf} onChange={(event) => { setUf(event.target.value); if (!event.target.value) setEntireUf(false); }}>
        <option value="">Não informada</option>
        {BRAZIL_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
      </select>
    </label>
    <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={entireUf} disabled={!uf} onChange={(event) => setEntireUf(event.target.checked)} />
      Atende todos os municípios dessa UF
    </label>
    <label htmlFor="cobertura-cidade" className="text-sm font-semibold text-foreground">Cidades adicionais atendidas</label>
    <input id="cobertura-cidade" className={field} value={search} onChange={(event) => setSearch(event.target.value)}
      placeholder="Buscar município (inclusive de outros estados)" />
    {matches.length > 0 && <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-border bg-card p-1">
      {matches.map((city) => <button key={city.id} type="button"
        disabled={cities.length >= 100 || cities.some((item) => item.id === city.id)}
        className="min-h-10 rounded-md p-2 text-left text-xs text-foreground hover:bg-accent disabled:opacity-40"
        onClick={() => { setCities((items) => [...items, city]); setSearch(""); setMatches([]); }}>
        Adicionar {city.name}/{city.uf}
      </button>)}
    </div>}
    <div className="flex flex-wrap gap-2">
      {cities.map((city) => <button type="button" key={city.id}
        onClick={() => setCities((items) => items.filter((item) => item.id !== city.id))}
        className="min-h-10 rounded-full border border-primary/30 bg-card px-3 text-xs text-foreground"
        aria-label={`Remover cidade atendida ${city.name}/${city.uf}`}>
        {city.name}/{city.uf} ×
      </button>)}
      {cities.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma cidade adicional.</span>}
    </div>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Observações sobre o atendimento
      <textarea className={field} value={notes} maxLength={400} rows={2} onChange={(event) => setNotes(event.target.value)} />
    </label>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Justificativa administrativa
      <textarea className={field} value={reason} maxLength={400} rows={2} onChange={(event) => setReason(event.target.value)} />
    </label>
    <button type="button" disabled={busy || !revision}
      className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
      onClick={() => void save()}>{busy ? "Salvando…" : "Salvar regiões atendidas"}</button>
    {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
  </section>;
}
