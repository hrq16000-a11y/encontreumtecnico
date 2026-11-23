import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Copy, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

type ContactResult = {
  ok?: boolean;
  available?: boolean;
  phone?: string;
  contact_suspended?: boolean;
};

/** Admin-only client-side field: never render private contact data in SSR or public listings. */
export function AdminTechnicianContactAccess({ recordKey }: { recordKey: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // A reused panel must never render the previous technician's private phone.
  const [resolvedRecordKey, setResolvedRecordKey] = useState<string | null>(null);
  const [copiedRecordKey, setCopiedRecordKey] = useState<string | null>(null);
  // Discard clipboard completions from an older view, even after A → B → A.
  const copyAttemptRef = useRef(0);

  useEffect(() => {
    let current = true;
    copyAttemptRef.current += 1;
    setLoading(true);
    setError(false);
    setPhone(null);
    setSuspended(false);
    setResolvedRecordKey(null);
    setCopiedRecordKey(null);
    void Promise.resolve(db.rpc("eut_admin_unified_contact", {
      _record_key: recordKey,
      _reason: null,
    })).then(({ data, error: rpcError }) => {
      if (!current) return;
      const result = data as ContactResult | null;
      if (rpcError || result?.ok !== true || typeof result.available !== "boolean") {
        throw new Error("Admin contact unavailable");
      }
      setPhone(result.available && typeof result.phone === "string" ? result.phone : null);
      setSuspended(Boolean(result.contact_suspended));
      setResolvedRecordKey(recordKey);
    }).catch(() => {
      if (current) {
        setError(true);
        setResolvedRecordKey(recordKey);
      }
    })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; copyAttemptRef.current += 1; };
  }, [recordKey]);

  // The equality guard also covers the render before the new key's effect runs.
  const matchesCurrentRecord = resolvedRecordKey === recordKey;
  const safePhone = matchesCurrentRecord && !loading && !error ? phone : null;
  const safeSuspended = matchesCurrentRecord && !loading && !error && suspended;

  async function copyPhone() {
    if (!safePhone) return;
    const attempt = ++copyAttemptRef.current;
    try {
      await navigator.clipboard.writeText(safePhone);
      if (copyAttemptRef.current === attempt) setCopiedRecordKey(recordKey);
    } catch {
      if (copyAttemptRef.current === attempt) setCopiedRecordKey(null);
    }
  }

  return <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-foreground">
    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="min-w-0 break-all" role="status">
      {loading || !matchesCurrentRecord ? "Telefone: carregando…" : error ? "Telefone indisponível" :
        `Telefone: ${safePhone ?? "não informado"}`}
      {safeSuspended && " · contato suspenso"}
    </span>
    {safePhone && <button type="button" onClick={() => void copyPhone()}
      aria-label="Copiar telefone"
      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-2 font-semibold text-foreground">
      <Copy className="h-4 w-4" aria-hidden="true" /> {copiedRecordKey === recordKey ? "Copiado" : "Copiar"}
    </button>}
  </div>;
}
