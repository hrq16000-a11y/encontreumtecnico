import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Phone } from "lucide-react";

const db = supabase as unknown as SupabaseClient;

export function validAdminContactReason(value: string): boolean {
  return value.trim().length >= 8 && value.trim().length <= 500;
}

type ContactResult = { ok?: boolean; available?: boolean; phone?: string };

/** Contact never enters SSR, a search index or the initial directory query. */
export function AdminTechnicianContactAccess({ recordKey }: { recordKey: string }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const epoch = useRef(0);
  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function conceal() {
    epoch.current++;
    if (revealTimeout.current) clearTimeout(revealTimeout.current);
    revealTimeout.current = null;
    setPhone(null);
  }

  useEffect(() => {
    const hideOnBlur = () => { if (document.visibilityState === "hidden") conceal(); };
    document.addEventListener("visibilitychange", hideOnBlur);
    window.addEventListener("pagehide", conceal);
    return () => {
      epoch.current++;
      if (revealTimeout.current) clearTimeout(revealTimeout.current);
      document.removeEventListener("visibilitychange", hideOnBlur);
      window.removeEventListener("pagehide", conceal);
    };
  }, []);

  async function openContact() {
    if (open) { conceal(); setReason(""); setOpen(false); return; }
    setOpen(true); setChecking(true); setError(""); setAvailable(null);
    const request = ++epoch.current;
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_unified_contact", {
        _record_key: recordKey, _reason: null,
      });
      if (request !== epoch.current) return;
      const result = data as ContactResult | null;
      if (rpcError || result?.ok !== true || typeof result.available !== "boolean") throw Error("unconfirmed");
      setAvailable(result.available);
    } catch {
      if (request === epoch.current) setError("Consulta indisponível. Verifique sua permissão administrativa.");
    } finally {
      if (request === epoch.current) setChecking(false);
    }
  }

  async function reveal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validAdminContactReason(reason) || checking || available !== true) return;
    conceal(); setChecking(true); setError("");
    const request = ++epoch.current;
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_unified_contact", {
        _record_key: recordKey, _reason: reason.trim(),
      });
      if (request !== epoch.current) return;
      const result = data as ContactResult | null;
      if (rpcError || result?.ok !== true || result.available !== true ||
        typeof result.phone !== "string" || result.phone.length < 7 || result.phone.length > 100) {
        throw Error("unconfirmed");
      }
      setPhone(result.phone);
      setReason("");
      revealTimeout.current = setTimeout(() => setPhone(null), 60_000);
    } catch {
      if (request === epoch.current) setError("O servidor não confirmou o acesso ao número.");
    } finally {
      if (request === epoch.current) setChecking(false);
    }
  }

  return <div className="min-w-0">
    <button type="button" onClick={() => void openContact()} aria-expanded={open}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold text-foreground hover:bg-muted">
      <Phone className="h-4 w-4" aria-hidden="true" /> {open ? "Fechar contato" : "Consultar contato"}
    </button>
    {open && <div className="mt-2 min-w-0 rounded-lg border border-primary/20 bg-muted/30 p-3 text-left text-sm">
      {checking && <p role="status">Consultando contato protegido…</p>}
      {available === false && !checking && <p role="status">Telefone não cadastrado. É possível informar um na edição da ficha.</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {available === true && !phone && <form onSubmit={(event) => void reveal(event)} className="grid min-w-0 gap-2">
        <label className="grid gap-1 font-semibold">Motivo da consulta (auditado)
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={500}
            required rows={2} placeholder="Ex.: conferência de cadastro administrativo"
            className="min-w-0 rounded-lg border border-input bg-background p-2 font-normal text-foreground" />
        </label>
        <button type="submit" disabled={checking || !validAdminContactReason(reason)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-50">
          <Eye className="h-4 w-4" aria-hidden="true" /> Ver número completo
        </button>
      </form>}
      {phone && <div className="grid gap-2">
        <p className="break-all font-bold text-foreground" role="status">{phone}</p>
        <p className="text-xs text-muted-foreground">Acesso auditado. O número será ocultado em até 60 segundos ou ao sair da aba.</p>
        <button type="button" onClick={conceal} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-input px-3 font-semibold">
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar número
        </button>
      </div>}
    </div>}
  </div>;
}
