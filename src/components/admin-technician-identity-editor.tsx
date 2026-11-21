import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MapPin, Save } from "lucide-react";
import { LocationField, type LocationFieldValue } from "@/components/location-field";

const db = supabase as unknown as SupabaseClient;
const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";

type IdentitySnapshot = {
  ok: boolean;
  available: boolean;
  email: string | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
  updated_at: string | null;
};
type FieldName = "email" | "postal_code" | "street" | "number" | "complement" | "neighborhood" | "city" | "uf";
type Draft = Record<FieldName, string>;
const empty: Draft = {
  email: "", postal_code: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", uf: "",
};

export function AdminTechnicianIdentityEditor({ recordKey }: { recordKey: string }) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [locationCityId, setLocationCityId] = useState<number | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setAvailable(false);
    setError(null);
    setFeedback(null);
    setDraft(empty);
    setLocationCityId(null);
    setRevision(null);
    void Promise.resolve(db.rpc("eut_admin_identity_get", { _record_key: recordKey }))
      .then(({ data, error: loadError }) => {
        if (!current) return;
        const identity = data as IdentitySnapshot | null;
        if (loadError || identity?.ok !== true) throw new Error("identity_unavailable");
        setAvailable(identity.available === true);
        if (!identity.available) return;
        setDraft({
          email: identity.email ?? "", postal_code: identity.postal_code ?? "",
          street: identity.street ?? "", number: identity.number ?? "",
          complement: identity.complement ?? "", neighborhood: identity.neighborhood ?? "",
          city: identity.city ?? "", uf: identity.uf ?? "",
        });
        setRevision(identity.updated_at);
      })
      .catch(() => { if (current) setError("Não foi possível consultar os dados cadastrais."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [recordKey]);

  function change(name: FieldName, value: string) {
    setDraft((previous) => ({ ...previous, [name]: value }));
    setFeedback(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading || !available) return;
    if (reason.trim().length < 8 || reason.trim().length > 400) {
      setError("Informe uma justificativa de 8 a 400 caracteres.");
      return;
    }
    if (draft.postal_code.trim() && draft.postal_code.replace(/\D/g, "").length !== 8) {
      setError("O CEP deve conter oito dígitos.");
      return;
    }
    setError(null);
    setFeedback(null);
    setSaving(true);
    const payload = {
      ...Object.fromEntries(Object.entries(draft).map(([key, value]) =>
        [key, value.trim() || null])),
      postal_code: draft.postal_code.replace(/\D/g, "") || null,
      uf: draft.uf.trim().toUpperCase() || null,
    };
    try {
      const { data, error: writeError } = await db.rpc("eut_admin_identity_save", {
        _record_key: recordKey, _expected_updated_at: revision,
        _payload: payload, _reason: reason.trim(),
      });
      if (writeError || data?.ok !== true || typeof data.updated_at !== "string") {
        throw new Error("save_not_confirmed");
      }
      setRevision(data.updated_at);
      setDraft((previous) => ({
        ...previous,
        ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value ?? ""])),
      }));
      setReason("");
      setFeedback("E-mail e endereço salvos no cadastro administrativo com auditoria.");
    } catch {
      setError("Não foi possível salvar. Recarregue a ficha se os dados mudaram em outra sessão.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando e-mail e endereço…</p>;
  if (!available) return <p className="text-sm text-muted-foreground">
    {error ?? "Cadastre esta ficha no diretório para gerenciar e-mail e endereço."}
  </p>;

  return <form onSubmit={(event) => void submit(event)}
    className="grid min-w-0 gap-3 rounded-lg border border-border bg-background/80 p-3"
    aria-label="E-mail e endereço cadastrais">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Mail className="h-4 w-4" aria-hidden="true" /> E-mail cadastral
    </h3>
    <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground">
      E-mail completo
      <input type="email" autoComplete="off" className={inputClass} maxLength={254}
        value={draft.email} placeholder="Não informado"
        onChange={(event) => change("email", event.target.value)} />
    </label>
    <p className="text-xs text-muted-foreground">
      E-mail de contato cadastral. Alterar este campo não modifica o e-mail de login da conta.
    </p>
    <h3 className="flex items-center gap-2 pt-1 text-sm font-semibold text-foreground">
      <MapPin className="h-4 w-4" aria-hidden="true" /> Endereço completo
    </h3>
    <div className="grid min-w-0 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground">
        Logradouro
        <input className={inputClass} maxLength={200} value={draft.street}
          onChange={(event) => change("street", event.target.value)} placeholder="Rua, avenida…" />
      </label>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground">
        Número
        <input className={inputClass} maxLength={25} value={draft.number}
          onChange={(event) => change("number", event.target.value)} placeholder="S/N" />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground">
        Complemento
        <input className={inputClass} maxLength={120} value={draft.complement}
          onChange={(event) => change("complement", event.target.value)} placeholder="Sala, conjunto…" />
      </label>
    </div>
    <LocationField label="Localização cadastral privada" required={false} hintEnabled={false}
      value={{uf:draft.uf,city:draft.city,municipalityIbgeId:locationCityId,
        neighborhood:draft.neighborhood,postalCode:draft.postal_code}}
      onChange={(next:LocationFieldValue) => {
        setLocationCityId(next.municipalityIbgeId);
        setDraft(previous => ({...previous,uf:next.uf,city:next.city,
          neighborhood:next.neighborhood,postal_code:next.postalCode}));
        setFeedback(null);
      }} />
    <p className="text-xs text-muted-foreground">
      Estes campos são administrativos; não alteram a localização pública nem a cobertura do técnico.
    </p>
    <label className="grid min-w-0 gap-1 text-xs font-semibold text-foreground">
      Justificativa da alteração
      <textarea className={inputClass} required minLength={8} maxLength={400} rows={2}
        value={reason} onChange={(event) => setReason(event.target.value)}
        placeholder="Motivo da inclusão ou atualização dos dados" />
    </label>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {feedback && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{feedback}</p>}
    <button type="submit" disabled={saving}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
      <Save className="h-4 w-4" aria-hidden="true" /> {saving ? "Salvando…" : "Salvar e-mail e endereço"}
    </button>
  </form>;
}