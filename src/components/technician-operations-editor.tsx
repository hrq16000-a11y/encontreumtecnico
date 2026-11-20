import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { brlToCents, centsToBrl, EMPTY_OPERATIONS, EQUIPMENT, sameTechnicianOperations,
  reconcileTechnicianOperationsCoverage, technicianOperationsSchema, TRANSPORT, validateTechnicianOperations, WINDOWS,
  type TechnicianOperations } from "@/lib/technician-operations-contract";

const db = supabase as unknown as SupabaseClient;
const input = "mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
type Municipality = { id: number; name: string; uf: string };

/** Single owner/admin editor; the RPC checks identity, ownership, role, conflicts
 * and writes an audit. Nothing here can override a suspended technician. */
export function TechnicianOperationsEditor({ technicianId, coverageCityIds, mode }: {
  technicianId: string;
  coverageCityIds: number[];
  mode: "technician" | "admin";
}) {
  const activeId = useRef(technicianId);
  activeId.current = technicianId;
  const [draft, setDraft] = useState<TechnicianOperations>(EMPTY_OPERATIONS);
  const [savedDraft, setSavedDraft] = useState<TechnicianOperations | null>(null);
  const [expectedAt, setExpectedAt] = useState<string | null>(null);
  const [cities, setCities] = useState<Municipality[]>([]);
  const [rate, setRate] = useState("");
  const [afterRate, setAfterRate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [coverageNotice, setCoverageNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const owner = technicianId;
    setLoading(true);
    setAvailable(false);
    setFeedback(null);
    setCoverageNotice(null);
    setDraft(EMPTY_OPERATIONS);
    setSavedDraft(null);
    setExpectedAt(null);
    setRate(""); setAfterRate(""); setReason("");
    void (async () => {
      const [result, places] = await Promise.all([
        db.rpc("eut_technician_operations_get", { _technician_id: owner }),
        coverageCityIds.length
          ? supabase.from("eut_ibge_municipalities").select("id,name,uf").in("id", coverageCityIds.slice(0, 5))
          : Promise.resolve({ data: [] as Municipality[], error: null }),
      ]);
      if (!live || activeId.current !== owner) return;
      if (result.error || result.data?.ok !== true || places.error) {
        setFeedback("O contrato operacional ainda não está disponível ou não foi possível validar a sessão. Nenhuma ficha foi alterada.");
        return;
      }
      const reconciled = result.data.profile === null
        ? { draft: EMPTY_OPERATIONS, removedCityIds: [] as number[] }
        : reconcileTechnicianOperationsCoverage(result.data.profile, coverageCityIds);
      if (!reconciled) {
        setFeedback("O servidor retornou dados operacionais incompatíveis. Nenhuma edição foi iniciada.");
        return;
      }
      setDraft(reconciled.draft);
      setSavedDraft(reconciled.draft);
      if (reconciled.removedCityIds.length) {
        setCoverageNotice(`A cobertura mudou: ${reconciled.removedCityIds.length} município(s) já não constam na lista atendida. Removemos essas classificações apenas do formulário. Confira as condições e salve conscientemente; nenhum dado foi gravado automaticamente.`);
      }
      setExpectedAt(result.data.updated_at ?? null);
      setRate(centsToBrl(reconciled.draft.km_rate_cents));
      setAfterRate(centsToBrl(reconciled.draft.km_rate_after_cents));
      setCities((places.data ?? []) as Municipality[]);
      setAvailable(true);
    })().catch(() => { if (live) setFeedback("Falha de conexão ao consultar a ficha operacional."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [technicianId, coverageCityIds.join(",")]);

  function toggle<K extends "equipment" | "service_windows">(key: K, code: TechnicianOperations[K][number]) {
    setDraft(previous => {
      const values = previous[key] as string[];
      return { ...previous, [key]: values.includes(code) ? values.filter(value => value !== code) : [...values, code] };
    });
  }

  function changeCity(id: number, value: "" | "free" | "paid") {
    setDraft(previous => ({ ...previous,
      free_city_ids: [...previous.free_city_ids.filter(n => n !== id), ...(value === "free" ? [id] : [])],
      paid_city_ids: [...previous.paid_city_ids.filter(n => n !== id), ...(value === "paid" ? [id] : [])],
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (loading || busy || !available) return;
    const payload = { ...draft, km_rate_cents: brlToCents(rate), km_rate_after_cents: brlToCents(afterRate) };
    const valid = validateTechnicianOperations(payload, coverageCityIds);
    if (!valid) {
      setFeedback("Revise as opções, os municípios e os valores por km. Use valores como 2,50 e não inclua contatos.");
      return;
    }
    if (mode === "admin" && (reason.trim().length < 8 || reason.trim().length > 400)) {
      setFeedback("A edição administrativa exige motivo de 8 a 400 caracteres.");
      return;
    }
    const owner = technicianId;
    setBusy(true); setFeedback(null);
    try {
      const { data, error } = await db.rpc("eut_technician_operations_save", {
        _technician_id: owner, _payload: valid, _expected_updated_at: expectedAt,
        _reason: mode === "admin" ? reason.trim() : null,
      });
      if (activeId.current !== owner) return;
      if (error || data?.ok !== true || data.technician_id !== owner || !data.updated_at) {
        setFeedback(error?.code === "40001" || error?.code === "PT409"
          ? "Outra sessão alterou esta ficha. Recarregue antes de editar; não repetimos a gravação."
          : "A gravação não foi confirmada. Nenhuma ação será repetida automaticamente.");
        return;
      }
      // Only an owner-scoped/admin-authorized reread can confirm persistence.
      const reloaded = await db.rpc("eut_technician_operations_get", { _technician_id: owner });
      if (activeId.current !== owner) return;
      const persisted = reloaded.data?.profile;
      if (reloaded.error || reloaded.data?.ok !== true ||
          reloaded.data.updated_at !== data.updated_at ||
          !technicianOperationsSchema.safeParse(persisted).success ||
          !sameTechnicianOperations(valid, persisted)) {
        setFeedback("O banco respondeu ao salvamento, mas a releitura divergiu. Recarregue a ficha antes de tentar novamente.");
        return;
      }
      setExpectedAt(data.updated_at);
      setDraft(valid);
      setSavedDraft(valid);
      setReason("");
      setCoverageNotice(null);
      setFeedback("Condições operacionais salvas e relidas no servidor. São declarações, não garantia de chegada.");
    } catch {
      if (activeId.current === owner) setFeedback("Falha de conexão. Recarregue e confirme antes de repetir a edição.");
    } finally {
      if (activeId.current === owner) setBusy(false);
    }
  }

  // Discard only the local editing state, returning to the last owner/admin-authorized
  // server read. This is not a database rollback and never invokes a mutation.
  const hasLocalChanges = savedDraft !== null && (
    JSON.stringify(draft) !== JSON.stringify(savedDraft) ||
    rate !== centsToBrl(savedDraft.km_rate_cents) ||
    afterRate !== centsToBrl(savedDraft.km_rate_after_cents) ||
    (mode === "admin" && reason.length > 0)
  );
  function discardLocalChanges() {
    if (busy || !savedDraft || !hasLocalChanges) return;
    setDraft(savedDraft);
    setRate(centsToBrl(savedDraft.km_rate_cents));
    setAfterRate(centsToBrl(savedDraft.km_rate_after_cents));
    setReason("");
    setFeedback("Alterações locais descartadas. Nenhum dado foi gravado.");
  }

  if (loading) return <p role="status" className="mt-3 text-sm text-muted-foreground">Carregando condições operacionais…</p>;
  if (!available) return <p role="alert" className="mt-3 rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground">
    {feedback || "Esta ficha não está disponível para edição operacional."}
  </p>;
  return <form onSubmit={save} className="mt-4 grid gap-5" aria-label="Condições operacionais do técnico">
    {coverageNotice && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">{coverageNotice}</p>}
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-bold text-foreground">Ferramentas disponíveis</h3>
      <p className="mt-1 text-xs text-muted-foreground">Marque somente equipamentos reais. Não informe número de série ou património.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {EQUIPMENT.map(option => <label key={option.code} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.equipment.includes(option.code)}
            onChange={() => toggle("equipment", option.code)} disabled={busy} />{option.label}
        </label>)}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold text-foreground">Meio de locomoção declarado
        <select className={input} value={draft.transport_mode ?? ""} disabled={busy}
          onChange={e => setDraft(v => ({ ...v, transport_mode: e.target.value as TechnicianOperations["transport_mode"] || null }))}>
          <option value="">Não informar</option>
          {TRANSPORT.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
        </select>
      </label>
      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm font-semibold text-foreground">
        <input type="checkbox" checked={draft.can_travel} disabled={busy}
          onChange={e => setDraft(v => ({ ...v, can_travel: e.target.checked }))} /> Disponibilidade para viajar
      </label>
    </div>
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-bold text-foreground">Períodos em que costuma atender</h3>
      <p className="mt-1 text-xs text-muted-foreground">Disponibilidade declarada. Plantão e chegada precisam ser confirmados em cada pedido.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {WINDOWS.map(option => <label key={option.code} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.service_windows.includes(option.code)} disabled={busy}
            onChange={() => toggle("service_windows", option.code)} />{option.label}
        </label>)}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["eta_business_minutes", "eta_outside_minutes"] as const).map(key =>
          <label key={key} className="text-sm font-semibold text-foreground">
            {key === "eta_business_minutes" ? "Chegada estimada em horário comercial (min)" : "Chegada estimada fora do comercial (min)"}
            <input type="number" min={15} max={1440} step={5} disabled={busy} className={input}
              value={draft[key] ?? ""} onChange={e => setDraft(v => ({ ...v, [key]: e.target.value === "" ? null : Number(e.target.value) }))} />
          </label>)}
      </div>
    </div>
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-bold text-foreground">Municípios e condições de deslocamento</h3>
      <p className="mt-1 text-xs text-muted-foreground">Use apenas as cidades IBGE já selecionadas na cobertura. Taxas aqui são estimativas do serviço do técnico, não a taxa da plataforma.</p>
      {!cities.length && <p className="mt-2 text-sm text-muted-foreground">Declare primeiro as cidades na aba de cobertura para diferenciá-las.</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {cities.map(city => <label key={city.id} className="text-sm font-semibold text-foreground">
          {city.name}/{city.uf}
          <select disabled={busy} className={input} value={draft.free_city_ids.includes(city.id) ? "free" : draft.paid_city_ids.includes(city.id) ? "paid" : ""}
            onChange={e => changeCity(city.id, e.target.value as "" | "free" | "paid")}>
            <option value="">Sob consulta</option><option value="free">Sem taxa por deslocamento</option><option value="paid">Pode cobrar deslocamento</option>
          </select>
        </label>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["free_km", "km_threshold"] as const).map(key => <label key={key} className="text-sm font-semibold text-foreground">
          {key === "free_km" ? "Quilômetros sem cobrança (se aplicável)" : "Limite para segunda faixa (km)"}
          <input type="number" min={0} max={2000} step={1} disabled={busy} className={input} value={draft[key] ?? ""}
            onChange={e => setDraft(v => ({ ...v, [key]: e.target.value === "" ? null : Number(e.target.value) }))} />
        </label>)}
        <label className="text-sm font-semibold text-foreground">R$/km até o limite informado
          <input inputMode="decimal" disabled={busy} value={rate} onChange={e => setRate(e.target.value)} placeholder="Ex.: 2,50" className={input} />
        </label>
        <label className="text-sm font-semibold text-foreground">R$/km após o limite (opcional)
          <input inputMode="decimal" disabled={busy} value={afterRate} onChange={e => setAfterRate(e.target.value)} placeholder="Ex.: 3,50" className={input} />
        </label>
      </div>
    </div>
    {mode === "admin" && <label className="text-sm font-semibold text-foreground">Motivo administrativo da edição (obrigatório)
      <textarea required minLength={8} maxLength={400} disabled={busy} rows={2} value={reason}
        onChange={e => setReason(e.target.value)} className={input} />
    </label>}
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Salvando e conferindo…" : "Salvar condições operacionais"}
      </button>
      <button type="button" onClick={discardLocalChanges} disabled={busy || !hasLocalChanges}
        className="min-h-12 rounded-xl border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
        Descartar alterações
      </button>
    </div>
    {feedback && <p role="status" className="text-sm text-foreground">{feedback}</p>}
  </form>;
}
