import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ABUSE_ACTIONS, parseAbuseSnapshot, type AbuseAction, type AbuseRow, type AbuseSnapshot } from "@/lib/abuse-policy";

const db = supabase as unknown as SupabaseClient;
const enabled = import.meta.env["VITE_EUT_ABUSE_ADMIN_ENABLED"] === "true";
const ACTION_LABEL: Record<AbuseAction,string> = {
  contact_access: "Acesso a contato",
  direct_request: "Solicitação direta",
  role_activation: "Ativação de perfil",
  member_invite: "Aceite de convite",
};

/** Read and release only through backend admin-guarded RPCs. Flag OFF by default.
 * This never creates a ban, changes existing blocked accounts/phones or enables A/B/C.
 */
export function AdminAbuseControls() {
  const [snapshot, setSnapshot] = useState<AbuseSnapshot | null>(null);
  const [action, setAction] = useState<AbuseAction | "todos">("todos");
  const [page, setPage] = useState(0);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<AbuseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setBusy(true);
    setError("");
    void Promise.resolve(db.rpc("eut_admin_abuse_snapshot", { _page: page, _action: action }))
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        const valid = rpcError ? null : parseAbuseSnapshot(data);
        if (!valid) { setSnapshot(null); setError("O controle não está instalado ou a consulta foi negada. Nenhuma restrição foi alterada."); }
        else setSnapshot(valid);
      }).catch(() => {
        if (active) {setSnapshot(null);setError("Não foi possível consultar o controle protegido.");}
      }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [action, page, revision]);

  async function release() {
    if (!selected || !snapshot || busy) return;
    const justification = reason.trim();
    if (justification.length < 12 || justification.length > 240) {
      setError("Justificativa obrigatória: de 12 a 240 caracteres."); return;
    }
    if (!window.confirm("Liberar SOMENTE o cooldown desta ação? Banimentos existentes permanecem intactos e a operação será auditada.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const {data,error: rpcError} = await db.rpc("eut_admin_abuse_release", {
        _target_user_id: selected.actor_id,
        _action_kind: selected.action_kind,
        _expected_updated_at: selected.updated_at,
        _reason: justification,
      });
      if (rpcError || data?.ok !== true) throw new Error("release_unconfirmed");
      const checked = await db.rpc("eut_admin_abuse_snapshot", { _page:page, _action:action });
      const latest = checked.error ? null : parseAbuseSnapshot(checked.data);
      const row = latest?.rows.find(item => item.actor_id === selected.actor_id && item.action_kind === selected.action_kind);
      if (!latest || !row || row.blocked_until !== null || row.updated_at === selected.updated_at) {
        throw new Error("readback_failed");
      }
      setSnapshot(latest);
      setSelected(null);setReason("");
      setNotice("Cooldown removido e persistência confirmada no servidor. Outros bloqueios preservados.");
    } catch {
      setError("Alteração não confirmada. Verifique o estado atual antes de repetir; nenhum resultado foi presumido.");
      setRevision(x=>x+1);
    } finally { setBusy(false); }
  }

  return <section className="mt-7 min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"
    aria-label="Segurança progressiva por operação">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" /> Antiabuso por operação
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Limites vinculados a falhas verificadas por conta autenticada, não por IP, VPN, operadora ou localização.
          Banimentos administrativos e números suspensos permanecem independentes.
        </p>
      </div>
      {enabled && <button type="button" disabled={busy} onClick={()=>setRevision(x=>x+1)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50">
        <RefreshCw className="h-4 w-4" aria-hidden="true"/> Atualizar
      </button>}
    </div>
    <p role="status" className="mt-3 text-sm font-semibold text-foreground">
      A/B/C: NO-GO — nenhuma liberação da coleta é autorizada por esta tela.
    </p>
    {!enabled ? <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
      Módulo de revisão em preparação. A RPC atômica, a auditoria e a configuração do edge
      ainda não foram habilitadas e verificadas em produção. Nenhuma decisão simulada será exibida.
    </p> : <>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-foreground">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">Ação protegida
          <select value={action} onChange={e=>{setAction(e.target.value as AbuseAction|"todos");setPage(0);setSelected(null);}}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground">
            <option value="todos">Todas</option>
            {ABUSE_ACTIONS.map(code=><option key={code} value={code}>{ACTION_LABEL[code]}</option>)}
          </select>
        </label>
      </div>
      {snapshot && <>
        <p className="mt-3 text-xs text-muted-foreground">Registros auditáveis: {snapshot.total}. Não são pessoas online nem visitantes únicos.</p>
        <div className="mt-3 grid gap-2">
          {snapshot.rows.length===0 && <p className="text-sm text-muted-foreground">Nenhuma restrição confirmada nesta consulta.</p>}
          {snapshot.rows.map(row=><div key={row.actor_id+":"+row.action_kind}
            className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{ACTION_LABEL[row.action_kind]} · conta …{row.actor_id.slice(-8)}</p>
              <p className="text-xs text-muted-foreground">{row.failures_15m} falhas/15 min · {row.failures_7d} falhas/7 dias</p>
              <p className="text-xs text-muted-foreground">{row.blocked_until ? "Suspensão até "+new Date(row.blocked_until).toLocaleString("pt-BR") : "Sem cooldown atual"}</p>
            </div>
            <button type="button" disabled={busy || !row.blocked_until || new Date(row.blocked_until).getTime() <= Date.now()}
              onClick={()=>{setSelected(row);setReason("");setError("");}}
              className="min-h-11 rounded-lg border border-input px-3 text-sm font-semibold disabled:opacity-50">
              Rever cooldown
            </button>
          </div>)}
        </div>
        <div className="mt-3 flex justify-between gap-3">
          <button type="button" disabled={busy || page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}
            className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40">Anterior</button>
          <span className="self-center text-xs text-muted-foreground">Página {page+1}</span>
          <button type="button" disabled={busy || (page+1)*20>=snapshot.total} onClick={()=>setPage(p=>p+1)}
            className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40">Próxima</button>
        </div>
        {snapshot.audit.length > 0 && <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-semibold">Histórico de liberações auditadas</summary>
          <ul className="mt-3 space-y-2">{snapshot.audit.map((event,i)=><li key={event.created_at+String(i)}
            className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("pt-BR")} · {ACTION_LABEL[event.action_kind]} · {event.actor_suffix} · {event.reason}</li>)}</ul>
        </details>}
      </>}
      {selected && <div className="mt-4 rounded-lg border border-primary/40 p-3">
        <p className="text-sm font-semibold">Revisar cooldown · {ACTION_LABEL[selected.action_kind]} · …{selected.actor_id.slice(-8)}</p>
        <label className="mt-3 grid gap-1 text-sm">Justificativa administrativa (12–240 caracteres)
          <textarea value={reason} maxLength={240} rows={3}
            onChange={e=>setReason(e.target.value)} className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-foreground"/>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy||reason.trim().length<12} onClick={()=>void release()}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Confirmar liberação auditada
          </button>
          <button type="button" onClick={()=>{setSelected(null);setReason("");}} className="min-h-11 rounded-lg border px-4 text-sm">Cancelar</button>
        </div>
      </div>}
    </>}
  </section>;
}
