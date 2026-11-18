import { useEffect, useState } from "react";
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    setPhone(null);
    setSuspended(false);
    setCopied(false);
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
    }).catch(() => { if (current) setError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [recordKey]);

  async function copyPhone() {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-foreground">
    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span className="min-w-0 break-all" role="status">
      {loading ? "Telefone: carregando…" : error ? "Telefone indisponível" :
        `Telefone: ${phone ?? "não informado"}`}
      {!loading && suspended && " · contato suspenso"}
    </span>
    {phone && <button type="button" onClick={() => void copyPhone()}
      aria-label="Copiar telefone"
      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-input px-2 font-semibold text-foreground">
      <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? "Copiado" : "Copiar"}
    </button>}
  </div>;
}
