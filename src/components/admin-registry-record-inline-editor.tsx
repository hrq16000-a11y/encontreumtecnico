import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminTechnicianRecordEditor,
  type AdminTechnicianRegistryRecord,
} from "@/components/admin-technician-record-editor";

const db = supabase as unknown as SupabaseClient;
const exactRegistryKey = /^registry:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const knownOrigins = new Set(["manual", "wordpress", "guiafix", "other_import"]);
const PAGE_SIZE = 100;
// Bound this on-demand lookup: never select a different person when names repeat.
const MAX_PAGES = 5;

export function AdminRegistryRecordInlineEditor({
  recordKey, name, onSaved, onCancel,
}: {
  recordKey: string;
  name: string;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const [record, setRecord] = useState<AdminTechnicianRegistryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setRecord(null);
    setError(null);
    setLoading(true);
    const expectedId = exactRegistryKey.exec(recordKey)?.[1]?.toLowerCase();
    const search = name.trim().slice(0, 80);
    if (!expectedId || !search) {
      setLoading(false);
      setError("Identificador da ficha inválido. Nenhuma alteração foi feita.");
      return () => { current = false; };
    }

    async function loadExactRecord() {
      for (let index = 0; index < MAX_PAGES; index++) {
        const offset = index * PAGE_SIZE;
        const { data, error: queryError } = await db.rpc("eut_admin_technician_registry_list", {
          _search: search, _limit: PAGE_SIZE, _offset: offset,
        });
        if (queryError) throw queryError;
        if (!current) return;
        const rows = Array.isArray(data) ? data as AdminTechnicianRegistryRecord[] : [];
        const match = rows.find((item) =>
          item.technician_id?.toLowerCase() === expectedId &&
          knownOrigins.has(item.origin) && typeof item.source_id === "string" &&
          typeof item.updated_at === "string");
        if (match) {
          setRecord(match); // Confirmed by the exact server UUID, never the name.
          return;
        }
        const total = Number(rows[0]?.total_count);
        if (!rows.length || (Number.isFinite(total) && offset + rows.length >= total) ||
            rows.length < PAGE_SIZE) break;
      }
      setError("Ficha exata não localizada nesta consulta. Abra a gestão de técnicos sem alterar outro cadastro.");
    }

    void loadExactRecord().catch(() => {
      if (current) setError("Não foi possível conferir a ficha no servidor. Nenhuma edição foi liberada.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [recordKey, name]);

  return <section aria-label="Edição administrativa da ficha"
    className="mt-3 min-w-0 rounded-lg border border-border p-3">
    {loading && <p role="status" className="text-sm text-muted-foreground">Conferindo a identidade exata…</p>}
    {!loading && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!loading && record && record.technician_id.toLowerCase() === exactRegistryKey.exec(recordKey)?.[1]?.toLowerCase() && <AdminTechnicianRecordEditor
      key={record.technician_id + record.updated_at}
      sourceId={record.source_id}
      existing={record}
      available
      onSaved={onSaved}
      onCancel={onCancel}
    />}
    {(loading || error) && <button type="button" onClick={onCancel}
      className="mt-3 min-h-11 rounded-lg border border-input px-4 text-sm font-semibold">
      Fechar
    </button>}
  </section>;
}
