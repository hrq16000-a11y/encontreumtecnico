import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { TechnicianAvatar } from "@/components/technician-avatar";
import { Check, Pencil, RotateCcw, ShieldAlert, UserRoundX, X } from "lucide-react";

type Technician = Tables<"technicians">;
type Status = Technician["status"];
type Action = "editar" | "aprovar" | "suspender" | "reativar" | "rejeitar" | "revisar";
const db = supabase as unknown as SupabaseClient;
const TABS: { key: Status; label: string }[] = [
  { key: "pendente", label: "Pendentes" }, { key: "aprovado", label: "Aprovados" },
  { key: "suspenso", label: "Suspensos" }, { key: "rejeitado", label: "Rejeitados" },
];
const actionLabels: Record<Action, string> = {
  editar: "Editar dados", aprovar: "Aprovar perfil", suspender: "Suspender perfil",
  reativar: "Reativar perfil", rejeitar: "Rejeitar perfil", revisar: "Enviar para revisão",
};

export function AdminTechnicianManager({
  technicians, onChanged,
}: { technicians: Technician[] | null; onChanged: () => Promise<void> }) {
  const [status, setStatus] = useState<Status>("aprovado");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ technician: Technician; action: Action } | null>(null);
  const [draft, setDraft] = useState({ display_name: "", bio: "", region: "" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function choose(technician: Technician, action: Action) {
    setTarget({ technician, action });
    setDraft({
      display_name: technician.display_name,
      bio: technician.bio ?? "",
      region: technician.region ?? "",
    });
    setReason("");
    setFeedback(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || busy) return;
    if (reason.trim().length < 8 || reason.length > 400) {
      setFeedback("Informe o motivo da alteração (8 a 400 caracteres).");
      return;
    }
    if (target.action !== "editar" &&
        !window.confirm(`Confirmar: ${actionLabels[target.action].toLowerCase()} — ${target.technician.display_name}? A ação será registrada no histórico.`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await db.rpc("eut_admin_technician_action", {
        p_id: target.technician.id, p_action: target.action,
        p_value: target.action === "editar" ? draft : {},
        p_reason: reason.trim(),
      });
      if (error) throw error;
      if (!data || data.id !== target.technician.id)
        throw new Error("Servidor não confirmou a atualização solicitada.");
      await onChanged();
      setTarget(null);
      setFeedback(`Alteração confirmada no banco: ${data.name} · ${data.status}. Auditoria registrada.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setFeedback("Não foi possível aplicar a alteração. " + detail.slice(0, 230));
    } finally {
      setBusy(false);
    }
  }
  const filtered = (technicians ?? []).filter((t) =>
    t.status === status && (!search.trim() ||
      [t.display_name, t.city, t.region ?? "", t.state_uf ?? ""]
        .some((v) => v.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))));
  return <section aria-label="Gestão administrativa de técnicos">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-foreground">Técnicos cadastrados</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Edite dados profissionais ou altere o status com motivo obrigatório. A aprovação e reativação
          dependem das regras de qualidade e bloqueio no banco; não liberam contatos privados.
        </p>
      </div>
      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
        Operações auditadas
      </span>
    </div>
    <label className="mt-5 block text-sm font-semibold text-foreground" htmlFor="admin-busca-tecnicos">Buscar técnico</label>
    <input id="admin-busca-tecnicos" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100}
      placeholder="Nome, cidade ou região"
      className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground" />
    <div role="tablist" aria-label="Status dos técnicos" className="mt-4 flex gap-2 overflow-x-auto pb-2">
      {TABS.map((tab) => <button key={tab.key} type="button" role="tab"
        aria-selected={status === tab.key} onClick={() => { setStatus(tab.key); setTarget(null); }}
        className={"min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold " +
          (status === tab.key ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground hover:bg-accent")}>
        {tab.label} ({technicians?.filter((t) => t.status === tab.key).length ?? 0})
      </button>)}
    </div>
    {feedback && <p role="status" className="mt-3 rounded-xl border border-border bg-muted/60 p-4 text-sm text-foreground">{feedback}</p>}
    {target && <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-sm" aria-label="Confirmar ação administrativa">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">{actionLabels[target.action]}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{target.technician.display_name} · {target.technician.city}</p>
        </div>
        <button type="button" onClick={() => setTarget(null)} aria-label="Cancelar edição"
          className="rounded-lg border border-input p-2 text-foreground"><X className="h-5 w-5" /></button>
      </div>
      {target.action === "editar" && <div className="grid gap-3">
        <label className="text-sm font-medium text-foreground">Nome profissional
          <input value={draft.display_name} required minLength={3} maxLength={80}
            onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground" />
        </label>
        <label className="text-sm font-medium text-foreground">Região declarada
          <input value={draft.region} maxLength={100}
            onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-foreground" />
        </label>
        <label className="text-sm font-medium text-foreground">Apresentação profissional
          <textarea rows={3} value={draft.bio} maxLength={1500}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-foreground" />
        </label>
        <p className="text-xs text-muted-foreground">Cidade-base, serviços e raio permanecem sujeitos às validações do cadastro profissional.</p>
      </div>}
      <label className="block text-sm font-semibold text-foreground">Motivo administrativo obrigatório
        <textarea required minLength={8} maxLength={400} rows={2} value={reason}
          placeholder="Por que esta alteração é necessária?"
          onChange={(e) => setReason(e.target.value)}
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-3 text-foreground" />
      </label>
      <button disabled={busy} type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60">
        <Check className="h-4 w-4" /> {busy ? "Gravando no banco…" : "Confirmar e registrar"}
      </button>
    </form>}
    {technicians === null ? <p role="status" className="mt-5 text-sm text-muted-foreground">Carregando técnicos…</p>
      : filtered.length === 0 ? <p className="mt-5 rounded-xl border border-border p-6 text-sm text-muted-foreground">Nenhum técnico encontrado neste filtro.</p>
      : <ul className="mt-5 grid gap-3">{filtered.map((technician) => (
        <li key={technician.id} className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-start gap-3">
            <TechnicianAvatar name={technician.display_name} avatarPath={technician.avatar_path} className="h-14 w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">{technician.display_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{technician.city}{technician.state_uf ? "/" + technician.state_uf : ""} · {technician.region ?? "Região a confirmar"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{technician.specialties.join(" · ")}</p>
              {technician.bio && <p className="mt-2 text-sm text-foreground">{technician.bio}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose(technician, "editar")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold text-foreground hover:bg-accent"><Pencil className="h-4 w-4" /> Editar</button>
            {technician.status === "aprovado" && <button type="button" onClick={() => choose(technician, "suspender")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-500/40 px-3 text-sm font-semibold text-foreground hover:bg-accent"><ShieldAlert className="h-4 w-4" /> Suspender</button>}
            {technician.status === "suspenso" && <button type="button" onClick={() => choose(technician, "reativar")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><RotateCcw className="h-4 w-4" /> Dessuspender</button>}
            {technician.status === "pendente" && <button type="button" onClick={() => choose(technician, "aprovar")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><Check className="h-4 w-4" /> Aprovar</button>}
            {technician.status === "pendente" && <button type="button" onClick={() => choose(technician, "rejeitar")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold text-foreground"><UserRoundX className="h-4 w-4" /> Rejeitar</button>}
            {technician.status === "rejeitado" && <button type="button" onClick={() => choose(technician, "revisar")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold text-foreground"><RotateCcw className="h-4 w-4" /> Reabrir análise</button>}
          </div>
        </li>
      ))}</ul>}
  </section>;
}
