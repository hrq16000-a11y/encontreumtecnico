import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Req } from "@/components/request-list";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import {
  buildAllocationPreview, safeAllocationMessage,
  type AllocationPreference, type AllocationTechnician, type AllocationPriority,
} from "@/lib/admin-allocation-preview";

const db = supabase as unknown as SupabaseClient;
const labels: Record<AllocationPriority, string> = { critica: "Crítica (manual)", alta: "Alta (manual)", normal: "Normal" };

/** Admin-only read-only operations preview. Parent /admin checks authenticated admin role. */
export function AdminAllocationPlanner({ requests }: { requests: readonly Req[] }) {
  const [technicians, setTechnicians] = useState<AllocationTechnician[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [preferences, setPreferences] = useState<Record<string, AllocationPreference>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setTechnicians([]);
    setCount(null);
    setConfirmed({});
    void (async () => {
      try {
        const { data, error: queryError, count: total } = await db.from("technicians")
          .select("id,display_name,city,state_uf,region,status,specialties,service_slugs", { count: "exact" })
          .eq("status", "aprovado").order("display_name").limit(200);
        if (!active) return;
        if (queryError || !Array.isArray(data) || typeof total !== "number")
          throw new Error("Consulta de técnicos incompleta");
        setTechnicians(data as AllocationTechnician[]);
        setCount(total);
      } catch {
        if (active) setError("Não foi possível consultar técnicos aprovados. Nenhuma sugestão será calculada.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reload]);

  const open = useMemo(() => requests.filter((r) => r.status === "aberta").slice(0, 30), [requests]);
  const result = useMemo(() => buildAllocationPreview(
    open, technicians, new Set(Object.keys(confirmed).filter((id) => confirmed[id])),
    preferences, Date.now(), 30,
  ), [open, technicians, confirmed, preferences]);
  const assigned = result.rows.filter((row) => row.technicianId).length;
  function edit(requestId: string, values: Partial<AllocationPreference>) {
    setPreferences((old) => ({ ...old, [requestId]: {
      priority: old[requestId]?.priority ?? "normal",
      ...old[requestId], ...values,
    } }));
  }
  async function copy() {
    setMessage(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Sem área de transferência");
      await navigator.clipboard.writeText(safeAllocationMessage(result));
      setMessage("Prévia sem dados do cliente copiada. Confira antes de compartilhar com pessoas autorizadas.");
    } catch { setMessage("Não foi possível copiar. Permita acesso à área de transferência no navegador."); }
  }

  return <section aria-label="Planejamento assistido de alocação" className="mt-6 space-y-4 rounded-2xl border border-border bg-background p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold text-foreground">Planejamento assistido · prévia interna</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Compara especialidade, município e UF confirmada manualmente. Não calcula rotas, não confirma SLA,
          não cria escala e não envia solicitações aos técnicos. Técnicos são profissionais independentes.
        </p>
      </div>
      <button type="button" className="min-h-11 rounded-lg border border-input px-3 text-sm font-semibold"
        disabled={loading} onClick={() => setReload((value) => value + 1)}>Reconsultar técnicos</button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
    {count !== null && count > technicians.length && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
      Consulta limitada a 200 técnicos de {count}. Esta prévia não cobre toda a rede.
    </p>}
    <div className="rounded-xl border border-border p-3">
      <h4 className="font-semibold text-foreground">Disponibilidade declarada para esta simulação</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Marque apenas quem confirmou disponibilidade fora do sistema. A marcação não é salva,
        não altera o status online e não confirma deslocamento, escala nem aceite.
      </p>
      {loading ? <p role="status" className="mt-2 text-sm">Consultando técnicos…</p>
        : technicians.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhum técnico aprovado disponível na consulta.</p>
        : <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {technicians.map((tech) => <label key={tech.id} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input type="checkbox" className="size-4 shrink-0" checked={confirmed[tech.id] === true}
              onChange={(event) => setConfirmed((old) => ({ ...old, [tech.id]: event.target.checked }))}/>
            <span className="min-w-0 break-words">{tech.display_name} · {tech.city}/{tech.state_uf ?? "UF não informada"}</span>
          </label>)}
        </div>}
    </div>
    {open.length === 0 ? <p role="status" className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
      Nenhum chamado aberto no conjunto carregado. Não há alocação real para produzir.
    </p> : <>
      <p className="text-sm text-muted-foreground">
        {result.included} chamado(s) considerados · {assigned} sugestão(ões) condicionais.
        UF, prioridade, prazo e horário são preenchidos manualmente e não são gravados.
        {requests.filter((r) => r.status === "aberta").length > 30 ? " Esta prévia considera somente os 30 primeiros chamados abertos carregados." : ""}
      </p>
      <div className="grid gap-3">
        {result.rows.map((row) => {
          const pref = preferences[row.requestId];
          return <article key={row.requestId} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h4 className="font-semibold text-foreground">Chamado {row.requestId.slice(0, 8)}</h4>
              <span className="text-sm text-muted-foreground">{row.category} · {row.city}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1 text-xs font-semibold">UF do chamado (confirmar)
                <select aria-label={"UF do chamado " + row.requestId.slice(0, 8)}
                  className="min-h-11 rounded-lg border border-input bg-background px-2 text-sm"
                  value={pref?.requestUf ?? ""}
                  onChange={(e) => edit(row.requestId, { requestUf: e.target.value })}>
                  <option value="">Selecionar UF</option>
                  {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Prioridade informada
                <select aria-label={"Prioridade do chamado " + row.requestId.slice(0, 8)}
                  className="min-h-11 rounded-lg border border-input bg-background px-2 text-sm"
                  value={pref?.priority ?? "normal"}
                  onChange={(e) => edit(row.requestId, { priority: e.target.value as AllocationPriority })}>
                  {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold">Prazo/SLA informado
                <input type="datetime-local" className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={pref?.deadline ?? ""} onChange={(e) => edit(row.requestId, { deadline: e.target.value })}/>
              </label>
              <label className="grid gap-1 text-xs font-semibold">Início proposto (manual)
                <input type="datetime-local" className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={pref?.plannedStart ?? ""} onChange={(e) => edit(row.requestId, { plannedStart: e.target.value })}/>
              </label>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">Técnico sugerido</dt><dd>{row.technicianName ?? "Nenhuma sugestão segura"}</dd></div>
              <div><dt className="font-semibold">Horário</dt><dd>{row.startLabel}</dd></div>
              <div className="sm:col-span-2"><dt className="font-semibold">Justificativa</dt><dd>{row.reason}</dd></div>
            </dl>
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-amber-700 dark:text-amber-300">
              {row.risks.map((risk) => <li key={risk}>{risk}</li>)}
            </ul>
          </article>;
        })}
      </div>
      <button type="button" disabled={!assigned}
        onClick={() => { void copy(); }}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold disabled:opacity-50">
        Copiar prévia para equipe autorizada (sem dados do cliente)
      </button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </>}
  </section>;
}
