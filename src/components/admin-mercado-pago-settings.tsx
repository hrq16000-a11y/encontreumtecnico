import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, CreditCard, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  centsToBrl, parseBrlToCents, validateMercadoPagoSettings,
  type MercadoPagoSettings,
} from "@/lib/mercado-pago-settings";

// The SQL contract is staged separately; generated Supabase types must not be
// modified until the migration is actually installed and types regenerated.
const paymentRpc = supabase as unknown as {
  rpc: (method: string, args?: Record<string, unknown>) => Promise<{
    data: unknown; error: { message: string } | null;
  }>;
};

export function AdminMercadoPagoSettings() {
  const [settings, setSettings] = useState<MercadoPagoSettings | null>(null);
  const [regular, setRegular] = useState("9,99");
  const [outside, setOutside] = useState("29,99");
  const [from, setFrom] = useState("09:00");
  const [until, setUntil] = useState("18:00");
  const [limit, setLimit] = useState<1 | 2>(2);
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function populate(value: MercadoPagoSettings) {
    setSettings(value);
    setRegular(centsToBrl(value.regular_price_cents));
    setOutside(centsToBrl(value.outside_price_cents));
    setFrom(value.regular_from);
    setUntil(value.regular_until);
    setLimit(value.daily_contact_limit);
    setEnabled(value.enabled);
  }

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const { data, error: rpcError } = await paymentRpc.rpc("eut_admin_mp_settings");
      if (rpcError) throw rpcError;
      populate(validateMercadoPagoSettings(data));
    } catch {
      setSettings(null);
      setError("As configurações financeiras não estão disponíveis para esta sessão. Verifique a instalação e a autorização do proprietário.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || saving) return;
    const regularCents = parseBrlToCents(regular);
    const outsideCents = parseBrlToCents(outside);
    if (regularCents === null || outsideCents === null || from >= until ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(from) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(until) ||
      reason.trim().length < 8 || reason.trim().length > 240) {
      setError("Informe valores válidos, horário inicial anterior ao final e justificativa de 8 a 240 caracteres.");
      setSuccess(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data, error: updateError } = await paymentRpc.rpc("eut_admin_mp_update_settings", {
        _enabled: enabled,
        _regular_price_cents: regularCents,
        _outside_price_cents: outsideCents,
        _regular_from: from,
        _regular_until: until,
        _daily_contact_limit: limit,
        _expected_version: settings.version,
        _reason: reason.trim(),
      });
      if (updateError || !(data && typeof data === "object" && (data as { ok?: unknown }).ok === true))
        throw new Error("Gravação não confirmada.");
      const latest = await paymentRpc.rpc("eut_admin_mp_settings");
      if (latest.error) throw latest.error;
      const confirmed = validateMercadoPagoSettings(latest.data);
      if (confirmed.version <= settings.version || confirmed.enabled !== enabled ||
        confirmed.regular_price_cents !== regularCents ||
        confirmed.outside_price_cents !== outsideCents || confirmed.regular_from !== from ||
        confirmed.regular_until !== until || confirmed.daily_contact_limit !== limit)
        throw new Error("Releitura divergente.");
      populate(confirmed);
      setReason("");
      setSuccess(true);
    } catch {
      setError("A gravação não pôde ser confirmada. Recarregue os dados e tente novamente; nenhuma alteração será presumida.");
    } finally { setSaving(false); }
  }

  return <section aria-labelledby="mp-admin-title" className="min-w-0 space-y-5">
    <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" aria-hidden="true" />
        <h2 id="mp-admin-title" className="text-xl font-extrabold text-foreground">Mercado Pago · Central financeira</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Configurações comerciais persistentes e auditadas, exclusivas do proprietário. Credenciais, reembolsos e liberação de telefones nunca são controlados diretamente pelo navegador.</p>
      <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">A ativação comercial não substitui o credenciamento, a validação do webhook nem a homologação do checkout. Sem esses requisitos, nenhuma cobrança ou contato deve ser liberado.</p>
    </div>
    <button type="button" onClick={() => void load()} disabled={loading || saving}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-4 text-sm font-semibold disabled:opacity-50">
      <RefreshCw className="h-4 w-4" aria-hidden="true" /> {loading ? "Carregando…" : "Recarregar configurações"}
    </button>
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}
    {success && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-600/30 p-3 text-sm text-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />Alteração gravada e confirmada por nova leitura.</p>}
    {settings && !loading && <form onSubmit={(event) => void save(event)} className="space-y-5">
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-4 text-sm font-semibold">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}
          className="h-5 w-5 accent-primary" /> Habilitar comercialmente o checkout
      </label>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Preço no horário comercial (R$)
          <input inputMode="decimal" value={regular} onChange={(event) => setRegular(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 font-normal" required />
        </label>
        <label className="text-sm font-semibold">Preço fora do horário (R$)
          <input inputMode="decimal" value={outside} onChange={(event) => setOutside(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 font-normal" required />
        </label>
        <label className="text-sm font-semibold">Início do horário (São Paulo)
          <input type="time" value={from} onChange={(event) => setFrom(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 font-normal" required />
        </label>
        <label className="text-sm font-semibold">Fim do horário (São Paulo)
          <input type="time" value={until} onChange={(event) => setUntil(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 font-normal" required />
        </label>
        <label className="text-sm font-semibold">Limite de contatos distintos por cliente/dia
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value) as 1 | 2)}
            className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 font-normal">
            <option value={1}>1 contato</option><option value={2}>2 contatos</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold">Justificativa para auditoria
        <textarea value={reason} onChange={(event) => setReason(event.target.value)}
          minLength={8} maxLength={240} required rows={3}
          placeholder="Explique a alteração (8 a 240 caracteres)"
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-3 font-normal" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Versão {settings.version} · última atualização {settings.updated_at ? new Date(settings.updated_at).toLocaleString("pt-BR") : "não informada"}</p>
        <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          <Save className="h-4 w-4" aria-hidden="true" /> {saving ? "Salvando…" : "Salvar e confirmar"}
        </button>
      </div>
    </form>}
  </section>;
}
