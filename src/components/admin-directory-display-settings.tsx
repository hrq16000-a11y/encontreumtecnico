import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { directoryDisplaySchema, type DirectoryDisplaySettings } from "@/lib/directory-display-settings";

const db = supabase as unknown as SupabaseClient;
type Snapshot = {
  settings: DirectoryDisplaySettings;
  version: number;
  updated_at: string;
  audit: Array<{ version: number; reason: string; changed_at: string }>;
};

const labels: Array<{ key: keyof DirectoryDisplaySettings; label: string; explanation: string }> = [
  { key: "auto_region", label: "Prioridade regional automática", explanation: "Usa município/UF aproximados da conexão, sem GPS. A escolha manual de região continua disponível." },
  { key: "online_priority", label: "Atividade recente no desempate", explanation: "Nunca ultrapassa um profissional de localização mais relevante." },
  { key: "referral_priority", label: "Indicações no desempate", explanation: "Aplicadas depois da localização e da atividade recente." },
  { key: "pioneer_priority", label: "Pioneiros no desempate", explanation: "Preserva o reconhecimento de pioneiros em condições equivalentes." },
  { key: "online_outline", label: "Contorno verde de atividade", explanation: "Sinalização visual discreta, sem afirmar disponibilidade garantida." },
  { key: "enriched_outline", label: "Contorno azul de perfil enriquecido", explanation: "Não expõe nem revela quais campos foram preenchidos." },
  { key: "photo_outline", label: "Contorno violeta de foto real", explanation: "Não inventa foto ou identidade verificada." },
  { key: "referral_label", label: "Selo público de indicações", explanation: "Pode ser ocultado sem alterar registros de indicação." },
];

function validSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const settings = directoryDisplaySchema.safeParse(data['settings']);
  if (!settings.success || !Number.isSafeInteger(data['version']) || (data['version'] as number) < 1 ||
      typeof data['updated_at'] !== "string" || !Array.isArray(data['audit'])) return null;
  if (!data['audit'].every((entry: unknown) => entry && typeof entry === "object" &&
    Number.isSafeInteger((entry as Snapshot["audit"][number]).version) &&
    typeof (entry as Snapshot["audit"][number]).reason === "string" &&
    typeof (entry as Snapshot["audit"][number]).changed_at === "string")) return null;
  return { settings: settings.data, version: data['version'] as number,
    updated_at: data['updated_at'], audit: data['audit'] as Snapshot["audit"] };
}

/** UI roles only control visibility; the RPC itself enforces the single verified owner. */
export function AdminDirectoryDisplaySettings() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<DirectoryDisplaySettings | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const { data, error: readError } = await db.rpc("eut_owner_directory_settings");
    const next = !readError && validSnapshot(data);
    if (!next) throw new Error("A configuração persistente não está disponível para esta sessão de proprietário.");
    setSnapshot(next);
    setDraft(next.settings);
    return next;
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: readError } = await db.rpc("eut_owner_directory_settings");
        if (!active) return;
        const next = !readError && validSnapshot(data);
        if (!next) setError("Configuração indisponível. O contrato do banco deve estar instalado e a conta deve ser a do proprietário.");
        else { setSnapshot(next); setDraft(next.settings); setError(null); }
      } catch { if (active) setError("Não foi possível carregar as preferências salvas."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const changed = snapshot && draft && JSON.stringify(snapshot.settings) !== JSON.stringify(draft);
  async function save() {
    if (!snapshot || !draft || !changed || busy || reason.trim().length < 8) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const { data, error: writeError } = await db.rpc("eut_owner_update_directory_settings", {
        _settings: draft, _expected_version: snapshot.version, _reason: reason.trim(),
      });
      if (writeError || !data || data.version !== snapshot.version + 1) throw new Error();
      const reread = await reload();
      if (reread.version !== data.version || JSON.stringify(reread.settings) !== JSON.stringify(draft)) throw new Error();
      setReason("");
      setMessage("Preferências gravadas, auditadas e relidas com sucesso.");
    } catch {
      setSnapshot(null);
      setDraft(null);
      setError("Não foi possível confirmar a gravação. Recarregue os dados antes de tentar novamente.");
    } finally { setBusy(false); }
  }

  return <section className="mb-6 rounded-2xl border border-primary/20 bg-card p-4 sm:p-6" aria-label="Configuração de ordenação e destaques">
    <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> Ordenação regional e destaques dos cards</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Configurações exclusivas do proprietário, com versão, justificativa e histórico. Localização aproximada; nunca solicita GPS nem expõe contatos.</p>
    {loading && <p className="mt-3 text-sm">Carregando preferências do servidor…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {draft && snapshot && <>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {labels.map(item => <label key={item.key} className="flex gap-3 rounded-xl border border-border p-3">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={draft[item.key]}
            disabled={busy} onChange={event => { setMessage(null); setDraft(current => current ? { ...current, [item.key]: event.target.checked } : current); }} />
          <span className="min-w-0"><span className="block text-sm font-semibold">{item.label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.explanation}</span></span>
        </label>)}
      </div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="directory-settings-reason">Justificativa da mudança (obrigatória)</label>
      <textarea id="directory-settings-reason" className="mt-2 min-h-20 w-full rounded-xl border border-input bg-background p-3 text-sm" maxLength={400}
        value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: Ajuste de apresentação e relevância regional." disabled={busy} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!changed || reason.trim().length < 8 || busy}
          onClick={() => void save()} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {busy ? "Gravando e relendo…" : "Salvar preferências"}
        </button>
        <span className="text-xs text-muted-foreground">Versão {snapshot.version}</span>
      </div>
      {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
      <details className="mt-4 rounded-xl border border-border p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4" /> Histórico de alterações <Sparkles className="h-4 w-4" /></summary>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          {snapshot.audit.length === 0 ? <li>Nenhuma alteração auditada.</li> : snapshot.audit.map(item =>
            <li key={item.version}>Versão {item.version} · {new Date(item.changed_at).toLocaleString("pt-BR")} · {item.reason}</li>)}
        </ul>
      </details>
    </>}
  </section>;
}
