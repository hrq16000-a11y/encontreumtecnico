import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";
import { publicTextProblem } from "@/lib/public-profile-text";
import { AdminTechnicianManager } from "@/components/admin-technician-manager";
import { AdminTechnicianIntakeManager } from "@/components/admin-technician-intake-manager";

// The three imports are independent sources, NOT additional approved accounts.
// Admin-only public fields; never query telephone, e-mail or private contacts here.
const captures = import.meta.glob("../../data/external-staging/guiafix-*.capture.json", {
  eager: true, import: "default",
}) as Record<string, unknown>;
const guiafix = readGuiafixStaging(Object.values(captures));
const db = supabase as unknown as SupabaseClient;
const PAGE_SIZE = 50;

type DirectoryRow = {
  key: string;
  portalId?: string;
  wpPostId?: number;
  name: string;
  location: string;
  specialty: string | null;
  origin: "portal" | "wordpress" | "guiafix";
  recordState?: string;
  demo?: boolean;
};

// PostgREST `or` filtering is structural syntax: only safe search characters enter it.
export function cleanUnifiedSearch(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").slice(0, 80).trim();
}

function appendUnique(current: DirectoryRow[], next: DirectoryRow[]): DirectoryRow[] {
  const seen = new Set(current.map((row) => row.key));
  return [...current, ...next.filter((row) => !seen.has(row.key))];
}

export function AdminTechnicianUnifiedDirectory({ adminOwnerId }: { adminOwnerId: string }) {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [operationalPage, setOperationalPage] = useState(0);
  const [legacyPage, setLegacyPage] = useState(0);
  const [legacy, setLegacy] = useState<DirectoryRow[]>([]);
  const [operational, setOperational] = useState<DirectoryRow[]>([]);
  const [legacyTotal, setLegacyTotal] = useState<number | null>(null);
  const [operationalTotal, setOperationalTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [correctedName, setCorrectedName] = useState("");
  const [reason, setReason] = useState("");
  const [wpAction, setWpAction] = useState<"corrigir_nome" | "arquivar" | "restaurar">("corrigir_nome");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(cleanUnifiedSearch(draft));
      setOperationalPage(0);
      setLegacyPage(0);
      setSelectedKey(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    async function load() {
      let techQuery = db.from("technicians")
        .select("id,display_name,city,state_uf,region,specialties,status", { count: "exact" });
      let wpQuery = db.from("legacy_review_profiles")
        .select("source_key,wp_post_id,kind,title,specialty_title,location1,location2,location3,demo_candidate", { count: "exact" })
        .eq("source_key", "wordpress_20261108")
        // Employer records are NOT technicians until evidence proves otherwise.
        .eq("kind", "candidate");
      if (term) {
        techQuery = techQuery.ilike("display_name", `%${term}%`);
        // The historical title is immutable. Searching only that field would lose
        // technicians after an admin saves a corrected display name in the overlay.
        const correctedNames = await db.from("eut_legacy_profile_management")
          .select("wp_post_id")
          .eq("source_key", "wordpress_20261108")
          .ilike("corrected_name", `%${term}%`)
          .limit(1000);
        if (!current) return;
        if (correctedNames.error) {
          setFailed(true);
          setLoading(false);
          return;
        }
        const matchedIds = (correctedNames.data ?? []).map((item) => item.wp_post_id)
          .filter((id): id is number => Number.isSafeInteger(id) && id >= 0);
        const searchFields = ["title", "location1", "location2", "location3"]
          .map((field) => `${field}.ilike.%${term}%`);
        if (matchedIds.length) searchFields.push(`wp_post_id.in.(${matchedIds.join(",")})`);
        wpQuery = wpQuery.or(searchFields.join(","));
      }
      const [tech, wp] = await Promise.all([
        techQuery.order("display_name").order("id")
          .range(operationalPage * PAGE_SIZE, (operationalPage + 1) * PAGE_SIZE - 1),
        wpQuery.order("title").order("wp_post_id").range(legacyPage * PAGE_SIZE, (legacyPage + 1) * PAGE_SIZE - 1),
      ]);
      if (!current) return;
      if (tech.error || wp.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const wpIds = (wp.data ?? []).map((item) => item.wp_post_id);
      const corrections = wpIds.length ? await db.from("eut_legacy_profile_management")
        .select("wp_post_id,corrected_name,record_state")
        .eq("source_key", "wordpress_20261108")
        .in("wp_post_id", wpIds) : { data: [], error: null };
      if (!current) return;
      if (corrections.error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const corrected = new Map((corrections.data ?? []).map((item) => [item.wp_post_id, item]));
      const operationalRows: DirectoryRow[] = (tech.data ?? []).map((item) => ({
        key: `portal:${item.id}`, portalId: item.id,
        name: item.display_name || "Técnico sem nome de exibição",
        location: [item.city, item.state_uf].filter(Boolean).join("/") || item.region || "Localidade não informada",
        specialty: item.specialties?.join(", ") || null,
        origin: "portal",
      }));
      const wpRows: DirectoryRow[] = (wp.data ?? []).map((item) => ({
        key: `wp:${item.kind}:${item.wp_post_id}`, wpPostId: item.wp_post_id,
        name: corrected.get(item.wp_post_id)?.corrected_name || item.title || "Técnico sem nome recuperado",
        location: [item.location1, item.location2, item.location3].filter(Boolean).join(" · ") || "Localidade não confirmada",
        specialty: item.specialty_title || null,
        origin: "wordpress", recordState: corrected.get(item.wp_post_id)?.record_state,
        demo: item.demo_candidate,
      }));
      setOperational((prev) => operationalPage === 0 ? operationalRows : appendUnique(prev, operationalRows));
      setOperationalTotal(tech.count);
      setLegacy((prev) => legacyPage === 0 ? wpRows : appendUnique(prev, wpRows));
      setLegacyTotal(wp.count);
      setLoading(false);
    }
    void load().catch(() => { if (current) { setFailed(true); setLoading(false); } });
    return () => { current = false; };
  }, [term, operationalPage, legacyPage, reload]);

  function refreshAfterSaved() {
    // Requery authoritative server values after an audited write. The selected
    // card may have changed its sort position or name and must not stay stale.
    setSelectedKey(null);
    setOperationalPage(0);
    setLegacyPage(0);
    setReload((version) => version + 1);
    setFeedback("Alteração confirmada. Atualizando a listagem de técnicos…");
  }

  const guiafixResults = useMemo(() => guiafix.filter((row) =>
    !term || normalizeGuiafixSearch(`${row.name} ${row.city} ${row.uf}`)
      .includes(normalizeGuiafixSearch(term))
  ).map((row): DirectoryRow => ({
    key: `guiafix:${row.key}`, name: row.name, location: `${row.city}/${row.uf} (local da fonte)`,
    specialty: row.category, origin: "guiafix",
  })), [term]);
  const results = useMemo(() => [...operational, ...legacy, ...guiafixResults]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key)),
  [operational, legacy, guiafixResults]);
  const total = operationalTotal === null || legacyTotal === null ? null
    : operationalTotal + legacyTotal + guiafixResults.length;
  const moreLegacy = legacyTotal !== null && legacy.length < legacyTotal;
  const moreOperational = operationalTotal !== null && operational.length < operationalTotal;

  function selectRow(row: DirectoryRow) {
    if (row.demo || row.origin === "guiafix") return;
    if (selectedKey === row.key) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey(row.key);
    setCorrectedName(row.name);
    setWpAction("corrigir_nome");
    setReason("");
    setFeedback(null);
  }

  async function submitWordPress(event: FormEvent, row: DirectoryRow) {
    event.preventDefault();
    if (saving || row.origin !== "wordpress" || row.demo || row.wpPostId === undefined) return;
    if (reason.trim().length < 8 || reason.trim().length > 400) {
      setFeedback("Informe a justificativa administrativa (8 a 400 caracteres).");
      return;
    }
    const newName = correctedName.trim();
    if (wpAction === "corrigir_nome" && (newName.length < 3 || newName.length > 80 ||
      publicTextProblem(newName, "identity"))) {
      setFeedback("Informe um nome profissional válido, sem contatos nem links.");
      return;
    }
    if (wpAction === "arquivar" && row.recordState === "excluido") return;
    if (wpAction === "restaurar" && row.recordState !== "excluido") return;
    if (wpAction !== "corrigir_nome" && !window.confirm(
      wpAction === "arquivar" ? "Arquivar esta ficha sem apagar o histórico?" : "Restaurar esta ficha à revisão, sem ativar contatos?"
    )) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { data, error } = await db.rpc("eut_admin_legacy_action", {
        p_ids: [row.wpPostId], p_action: wpAction,
        p_value: wpAction === "corrigir_nome" ? newName : "",
        p_reason: reason.trim(),
      });
      if (error) throw error;
      if (data?.updated !== 1 || data?.published !== false)
        throw new Error("O banco não confirmou a operação auditada.");
      setLegacy((before) => before.map((item) => item.key === row.key
        ? { ...item,
            name: wpAction === "corrigir_nome" ? newName : item.name,
            ...(wpAction === "corrigir_nome" ? {} : {
              recordState: wpAction === "arquivar" ? "excluido" : "pendente",
            }) }
        : item));
      setFeedback("Alteração registrada no banco. O cadastro original e os contatos privados foram preservados.");
      setSelectedKey(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 180) : "Tente novamente.";
      setFeedback(`Não foi possível salvar. ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  return <section className="mt-6 min-w-0 rounded-2xl border border-primary/20 bg-card p-3 sm:p-6" aria-label="Busca unificada de técnicos">
    <h2 className="text-xl font-bold text-foreground">Gestão de técnicos</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Uma lista e uma pesquisa para todos os técnicos encontrados. A origem é apenas um dado de auditoria.
      Fichas recuperadas não recebem automaticamente login nem liberação de contatos.
    </p>
    <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="admin-unified-technician-search">Buscar técnico</label>
    <input id="admin-unified-technician-search" value={draft} onChange={(event) => setDraft(event.target.value)}
      maxLength={80} placeholder="Nome, cidade ou UF" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground" />
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {loading ? "Consultando fontes…" : failed ? "Consulta incompleta: verifique a permissão ou conexão." :
        `${total === null ? "Total indisponível" : total.toLocaleString("pt-BR") + " registros encontrados"} · ${results.length} exibidos`}
    </p>
    {feedback && <p role="status" className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">{feedback}</p>}
    {!failed && <ul className="mt-4 grid min-w-0 gap-3">
      {results.map((row) => <li key={row.key} className="min-w-0 rounded-xl border border-border bg-background p-3 sm:p-4">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <strong className="break-words text-foreground">{row.name}</strong>
            <p className="mt-1 text-sm text-muted-foreground">{row.location}</p>
            {row.specialty && <p className="mt-1 break-words text-xs text-muted-foreground">{row.specialty}</p>}
            {row.demo && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Demonstração protegida: indisponível para ativação.</p>}
          </div>
          {row.origin !== "guiafix" && !row.demo &&
            <button type="button" onClick={() => selectRow(row)} aria-expanded={selectedKey === row.key}
              className="min-h-11 w-full shrink-0 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 sm:w-auto">
              {selectedKey === row.key ? "Fechar gestão" : "Gerenciar técnico"}
            </button>}
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer py-1">Rastreabilidade</summary>
          <p className="mt-1">Origem: {row.origin === "portal" ? "cadastro próprio" : row.origin === "wordpress" ? "acervo WordPress" : "captura Guiafix"}.</p>
        </details>
        {row.origin === "guiafix" && <p className="mt-2 text-xs text-muted-foreground">
          Ficha de referência sem vínculo persistido. A edição requer importação administrativa homologada.
        </p>}
        {selectedKey === row.key && row.portalId &&
          <div className="mt-4 border-t border-border pt-4">
            <AdminTechnicianManager adminOwnerId={adminOwnerId} selectedTechnicianId={row.portalId}
              onUpdated={refreshAfterSaved} />
          </div>}
        {selectedKey === row.key && row.wpPostId !== undefined && !row.demo &&
          <form onSubmit={(event) => void submitWordPress(event, row)}
            className="mt-4 grid min-w-0 gap-3 border-t border-border pt-4" aria-label={`Gerenciar técnico ${row.name}`}>
            <h3 className="text-base font-semibold text-foreground">Alteração administrativa auditada</h3>
            <div className="flex flex-wrap gap-2">
              {(["corrigir_nome", "arquivar", "restaurar"] as const)
                .filter((action) => action === "corrigir_nome" ||
                  (action === "arquivar" && row.recordState !== "excluido") ||
                  (action === "restaurar" && row.recordState === "excluido"))
                .map((action) => <button key={action} type="button"
                  aria-pressed={wpAction === action}
                  onClick={() => { setWpAction(action); setReason(""); setFeedback(null); }}
                  className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " +
                    (wpAction === action ? "border-primary bg-primary/10 text-primary" : "border-input text-foreground")}>
                  {action === "corrigir_nome" ? "Editar nome" : action === "arquivar" ? "Arquivar" : "Restaurar"}
                </button>)}
            </div>
            {wpAction === "corrigir_nome" && <label className="grid gap-1 text-sm font-semibold text-foreground">
              Nome profissional
              <input value={correctedName} onChange={(event) => setCorrectedName(event.target.value)}
                required minLength={3} maxLength={80} className="min-h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-foreground" />
            </label>}
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Motivo obrigatório para auditoria
              <textarea value={reason} onChange={(event) => setReason(event.target.value)}
                required minLength={8} maxLength={400} rows={2}
                className="min-w-0 rounded-lg border border-input bg-background p-3 text-foreground" />
            </label>
            <p className="text-xs text-muted-foreground">
              A edição altera a ficha de gestão, preservando o original. Telefone privado, categorias e cidade
              exigem o backend administrativo completo; este formulário não simula essas gravações.
            </p>
            <button type="submit" disabled={saving}
              className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
              {saving ? "Gravando…" : wpAction === "corrigir_nome" ? "Salvar nome no banco" :
                wpAction === "arquivar" ? "Confirmar arquivamento" : "Confirmar restauração"}
            </button>
          </form>}
      </li>)}
    </ul>}
    {!loading && !failed && results.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nenhum registro corresponde à busca.</p>}
    {!failed && (moreLegacy || moreOperational) && <button type="button" disabled={loading}
      onClick={() => { if (moreLegacy) setLegacyPage((n) => n + 1); if (moreOperational) setOperationalPage((n) => n + 1); }}
      className="mt-4 min-h-11 w-full rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-50 sm:w-auto">
      {loading ? "Carregando…" : "Carregar mais técnicos"}
    </button>}
    <p className="mt-4 text-xs text-muted-foreground">
      A criação de fichas com contatos e a importação de lotes dependem da API administrativa em homologação.
      Nenhuma ficha de origem ou demonstração é ativada automaticamente.
    </p>
    <AdminTechnicianIntakeManager />
  </section>;
}
