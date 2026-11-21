import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Settings2, ShieldCheck } from "lucide-react";

const db = supabase as unknown as SupabaseClient;

/** One feature only. Persistence/ownership/audit are enforced in the SQL RPC. */
export function AdminFeatureSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await db.rpc("eut_home_public_proof_visible");
        if (!active) return;
        if (result.error || typeof result.data !== "boolean") {
          setError("Configuração indisponível. O contrato do banco ainda precisa ser homologado.");
        } else {
          setEnabled(result.data);
        }
      } catch {
        if (!active) return;
        setError("Configuração indisponível. O contrato do banco ainda precisa ser homologado.");
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || enabled === null || reason.trim().length < 8 || reason.trim().length > 240) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const expected = enabled;
      const next = !expected;
      const result = await db.rpc("eut_admin_set_home_public_proof", {
        _enabled: next, _expected_enabled: expected, _reason: reason.trim(),
      });
      const payload = result.data as { ok?: unknown; enabled?: unknown } | null;
      if (result.error || payload?.ok !== true || payload.enabled !== next) {
        throw new Error("A alteração não foi confirmada pelo servidor.");
      }
      // Somente a releitura do mesmo contrato permite informar "salvo".
      const checked = await db.rpc("eut_home_public_proof_visible");
      if (checked.error || checked.data !== next) {
        throw new Error("Não foi possível confirmar o estado persistido. Recarregue antes de repetir.");
      }
      setEnabled(next);
      setReason("");
      setNotice(next ? "Seção habilitada e confirmada no servidor." : "Seção desabilitada e confirmada no servidor.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  }

  return <section aria-label="Central de configurações" className="space-y-6">
    <div>
      <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
        <Settings2 className="h-5 w-5 text-primary" aria-hidden="true" /> Configurações do portal
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Primeiro controle operacional: exibição dos exemplos de perfis reais na Home.
        O histórico, os cadastros e os contatos privados não são alterados.
      </p>
    </div>
    <form onSubmit={(event) => void save(event)} className="max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">Perfis públicos reais na Home</h3>
          <p className="mt-1 text-sm text-muted-foreground">Oculta ou exibe apenas a seção ilustrativa de técnicos já publicados.</p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold" role="status">
          {loading ? "Consultando…" : enabled === null ? "Indisponível" : enabled ? "Habilitado" : "Desabilitado"}
        </span>
      </div>
      <label className="block text-sm font-medium text-foreground" htmlFor="admin-home-proof-reason">
        Justificativa da alteração (8 a 240 caracteres)
      </label>
      <textarea id="admin-home-proof-reason" value={reason} maxLength={240} rows={3}
        onChange={(event) => setReason(event.target.value)}
        disabled={saving || enabled === null} placeholder="Ex.: Ajuste editorial da seção de perfis reais"
        className="w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground disabled:opacity-60" />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        Somente o proprietário autenticado pode gravar. Cada mudança é auditada no banco.
      </p>
      <button type="submit" disabled={saving || enabled === null || reason.trim().length < 8}
        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {saving ? "Salvando…" : enabled ? "Desabilitar seção" : "Habilitar seção"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm font-medium text-primary">{notice}</p>}
    </form>
    <nav aria-label="Outros controles existentes" className="flex flex-wrap gap-3 text-sm">
      <Link to="/admin/$secao" params={{ secao: "catalogo" }} className="text-primary underline">Categorias e serviços</Link>
      <Link to="/admin/$secao" params={{ secao: "patrocinadores" }} className="text-primary underline">Patrocinadores e campanhas</Link>
      <Link to="/admin/$secao" params={{ secao: "contas" }} className="text-primary underline">Contas e bloqueios</Link>
    </nav>
  </section>;
}
