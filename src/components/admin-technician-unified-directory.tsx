import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";
import { publicTextProblem } from "@/lib/public-profile-text";
import { AdminTechnicianManager } from "@/components/admin-technician-manager";
import { AdminTechnicianRecordEditor, type AdminTechnicianRegistryRecord } from "@/components/admin-technician-record-editor";

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
  registry?: AdminTechnicianRegistryRecord;
  name: string;
  location: string;
  specialty: string | null;
  origin: "portal" | "wordpress" | "guiafix" | "manual" | "other_import";
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
  const [registryPage, setRegistryPage] = useState(0);
  const [legacy, setLegacy] = useState<DirectoryRow[]>([]);
  const [operational, setOperational] = useState<DirectoryRow[]>([]);
  const [registry, setRegistry] = useState<AdminTechnicianRegistryRecord[]>([]);
  const [legacyTotal, setLegacyTotal] = useState<number | null>(null);
  const [operationalTotal, setOperationalTotal] = useState<number | null>(null);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryAvailable, setRegistryAvailable] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [manualSourceId, setManualSourceId] = useState<string | null>(null);
  const [csvInfo, setCsvInfo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [wpImportKey, setWpImportKey] = useState<string | null>(null);
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
      setRegistryPage(0);
      setSelectedKey(null);
      setWpImportKey(null);
      setWpImportKey(null);
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

  useEffect(() => {
    let current = true;
    setRegistryLoading(true);
    void db.rpc("eut_admin_technician_registry_list", {
      _search: term, _limit: PAGE_SIZE, _offset: registryPage * PAGE_SIZE,
    }).then(({ data, error }) => {
      if (!current) return;
      setRegistryLoading(false);
      if (error) {
        setRegistryAvailable(false);
        const absent = error.code === "PGRST202" || error.code === "42883";
        setRegistryError(absent
          ? "Cadastro manual ainda não ativado no banco. A listagem existente continua disponível."
          : "Não foi possível consultar os registros administrativos. Verifique a sessão ou conexão.");
        return;
      }
      setRegistryAvailable(true);
      setRegistryError(null);
      const rows = (data ?? []) as AdminTechnicianRegistryRecord[];
      setRegistry((before) => registryPage === 0 ? rows : [
        ...before, ...rows.filter((item) => !before.some((old) => old.technician_id === item.technician_id)),
      ]);
      if (rows[0]) setRegistryTotal(Number(rows[0].total_count) || 0);
      else if (registryPage === 0) setRegistryTotal(0);
    }).catch(() => {
      if (!current) return;
      setRegistryLoading(false);
      setRegistryAvailable(false);
      setRegistryError("Sem conexão com a API administrativa; nenhuma gravação está habilitada.");
    });
    return () => { current = false; };
  }, [term, registryPage, reload]);

  function refreshAfterSaved() {
    // Requery authoritative server values after an audited write. The selected
    // card may have changed its sort position or name and must not stay stale.
    setSelectedKey(null);
    setWpImportKey(null);
    setOperationalPage(0);
    setLegacyPage(0);
    setRegistryPage(0);
    setManualSourceId(null);
    setWpImportKey(null);
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
  const results = useMemo(() => {
    const importedWp = new Set(registry.filter((r) => r.origin === "wordpress").map((r) => r.source_id));
    const importedGuiafix = new Set(registry.filter((r) => r.origin === "guiafix").map((r) => r.source_id));
    const registryRows: DirectoryRow[] = registry.map((item) => ({
      key: `registry:${item.technician_id}`, registry: item,
      name: item.display_name, origin: item.origin,
      location: [item.region_approx, item.ddd ? `DDD ${item.ddd}` : null,
        item.city_ibge_id ? `IBGE ${item.city_ibge_id}` : null].filter(Boolean).join(" · ") || "Localidade não informada",
      specialty: item.category_slugs.join(" · ") || null,
      demo: item.is_demo,
    }));
    return [...operational,
      ...legacy.filter((item) => !importedWp.has(`wordpress_20261108:${item.wpPostId}`)),
      ...guiafixResults.filter((item) =>
        !importedGuiafix.has(item.key) && !importedGuiafix.has(item.key.slice("guiafix:".length))),
      ...registryRows]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key));
  }, [operational, legacy, guiafixResults, registry]);
  const moreLegacy = legacyTotal !== null && legacy.length < legacyTotal;
  const moreOperational = operationalTotal !== null && operational.length < operationalTotal;
  const moreRegistry = registryAvailable && registry.length < registryTotal;

  function openManualForm() {
    if (manualSourceId) { setManualSourceId(null); return; }
    // Generate exactly once per form: retries must reuse this provenance key.
    // Four-character groups prevent accidental ten-digit sequences prohibited by SQL.
    const groups = window.crypto.randomUUID().replace(/-/g, "").match(/.{1,4}/g) ?? [];
    setManualSourceId(`manual:${groups.join("-")}`);
    setSelectedKey(null);
    setFeedback(null);
  }

  async function inspectImport(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setCsvInfo("Arquivo acima de 2 MB. Divida em lotes menores.");
      return;
    }
    try {
      // Read header/count locally: no row data, names or phone numbers are uploaded.
      const contents = await file.text();
      const lines = contents.split(/\r?\n/).filter(Boolean);
      const columns = (lines[0] ?? "").replace(/^\uFEFF/, "").toLowerCase()
        .split(/[;,\t]/).map((value) => value.trim());
      setCsvInfo(columns.includes("nome") || columns.includes("name")
        ? `${Math.max(0, lines.length - 1)} linhas identificadas, ${columns.length} colunas. Prévia local: nenhum cadastro foi enviado ou importado.`
        : "Cabeçalho sem coluna 'nome' ou 'name'. Nenhum cadastro foi enviado.");
    } catch {
      setCsvInfo("Não foi possível analisar o arquivo localmente.");
    }
  }

  function selectRow(row: DirectoryRow) {
    if (row.demo || (row.origin === "guiafix" && !row.registry)) return;
    if (selectedKey === row.key && wpImportKey === null) {
      setSelectedKey(null);
      return;
    }
    setSelectedKey(row.key);
    setWpImportKey(null);
    setCorrectedName(row.name);
    setWpAction("corrigir_nome");
    setReason("");
    setFeedback(null);
  }

  function openWordPressImport(row: DirectoryRow) {
    if (row.demo || row.origin !== "wordpress" || row.wpPostId === undefined || row.registry) return;
    setSelectedKey(row.key);
    setWpImportKey(row.key);
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
    } catch {
      // PostgREST errors may echo the payload; never render a private contact or SQL data.
      setFeedback("Não foi possível salvar esta ficha. Confira os dados, a justificativa e sua permissão administrativa.");
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
    <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={openManualForm} aria-expanded={Boolean(manualSourceId)}
        className="min-h-12 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
        {manualSourceId ? "Fechar cadastro" : "+ Adicionar técnico"}
      </button>
      {registryError && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{registryError}</p>}
    </div>
    {manualSourceId && <AdminTechnicianRecordEditor key={manualSourceId} sourceId={manualSourceId}
      available={registryAvailable} onCancel={() => setManualSourceId(null)}
      onSaved={(message) => { refreshAfterSaved(); setFeedback(message); }} />}
    <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="admin-unified-technician-search">Buscar técnico</label>
    <input id="admin-unified-technician-search" value={draft} onChange={(event) => setDraft(event.target.value)}
      maxLength={80} placeholder="Nome, cidade ou UF" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground" />
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {loading || registryLoading ? "Consultando registros…" : failed ? "Consulta incompleta: verifique a permissão ou conexão." :
        `${results.length} técnicos exibidos${moreLegacy || moreOperational || moreRegistry ? " · mais registros disponíveis" : ""}`}
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {(row.registry || row.origin !== "guiafix") && !row.demo &&
              <button type="button" onClick={() => selectRow(row)} aria-expanded={selectedKey === row.key && wpImportKey === null}
                className="min-h-11 w-full shrink-0 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 sm:w-auto">
                {selectedKey === row.key && wpImportKey === null ? "Fechar gestão" : "Gerenciar técnico"}
              </button>}
            {row.origin === "wordpress" && row.wpPostId !== undefined && !row.demo && !row.registry &&
              <button type="button" onClick={() => openWordPressImport(row)} aria-expanded={wpImportKey === row.key}
                className="min-h-11 w-full shrink-0 rounded-xl border border-input px-4 text-sm font-semibold text-foreground sm:w-auto">
                {wpImportKey === row.key ? "Preparando importação" : "Importar ficha para gestão"}
              </button>}
          </div>
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer py-1">Rastreabilidade</summary>
          <p className="mt-1">Origem: {row.origin === "portal" ? "cadastro próprio" :
            row.origin === "wordpress" ? "acervo WordPress" : row.origin === "guiafix" ? "captura Guiafix" :
            row.origin === "manual" ? "inclusão administrativa" : "importação identificada"}.</p>
        </details>
        {row.origin === "guiafix" && !row.registry && <p className="mt-2 text-xs text-muted-foreground">
          Ficha de referência sem vínculo persistido. A edição requer importação administrativa homologada.
        </p>}
        {row.registry && <p className="mt-2 text-xs text-muted-foreground">
          {row.registry.archived ? "Registro arquivado" : row.registry.admin_active ? "Registro administrativo ativo" : "Registro administrativo não ativo"}
          {row.registry.contact_last4 ? ` · Contato privado final ${row.registry.contact_last4}` : ""}
        </p>}
        {selectedKey === row.key && row.registry &&
          <AdminTechnicianRecordEditor key={row.registry.technician_id + row.registry.updated_at}
            sourceId={row.registry.source_id} existing={row.registry} available={registryAvailable}
            onCancel={() => setSelectedKey(null)}
            onSaved={(message) => { refreshAfterSaved(); setFeedback(message); }} />}
        {selectedKey === row.key && wpImportKey === row.key && row.wpPostId !== undefined && !row.demo && !row.registry &&
          <AdminTechnicianRecordEditor key={`wp-import:${row.wpPostId}`}
            sourceId={`wordpress_20261108:${row.wpPostId}`} createOrigin="wordpress"
            importedName={row.name} importedDemo={Boolean(row.demo)} available={registryAvailable}
            onCancel={() => { setWpImportKey(null); setSelectedKey(null); }}
            onSaved={(message) => { refreshAfterSaved(); setDraft(row.name); setFeedback(message); }} />}
        {selectedKey === row.key && row.portalId && !row.registry &&
          <div className="mt-4 border-t border-border pt-4">
            <AdminTechnicianManager adminOwnerId={adminOwnerId} selectedTechnicianId={row.portalId}
              onUpdated={refreshAfterSaved} />
          </div>}
        {selectedKey === row.key && wpImportKey !== row.key && row.wpPostId !== undefined && !row.registry && !row.demo &&
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
              Esta ação corrige apenas a ficha WordPress, sem alterar a origem. A importação para o registro
              administrativo completo exige vínculo de origem comprovado; este formulário não simula outras gravações.
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
    {!failed && (moreLegacy || moreOperational || moreRegistry) && <button type="button" disabled={loading || registryLoading}
      onClick={() => { if (moreLegacy) setLegacyPage((n) => n + 1); if (moreOperational) setOperationalPage((n) => n + 1); if (moreRegistry) setRegistryPage((n) => n + 1); }}
      className="mt-4 min-h-11 w-full rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-50 sm:w-auto">
      {loading || registryLoading ? "Carregando…" : "Carregar mais técnicos"}
    </button>}
    <p className="mt-4 text-xs text-muted-foreground">
      Cadastro manual e edição avançada funcionam somente após instalar as RPCs homologadas.
      Importação de lotes ainda não está disponível; nenhuma ficha de origem ou demonstração é ativada automaticamente.
    </p>
    <fieldset className="mt-4 space-y-2 rounded-xl border border-dashed border-border p-3">
      <legend className="text-sm font-semibold">Preparar importação CSV</legend>
      <p className="text-xs text-muted-foreground">
        Apenas conferir cabeçalho e quantidade no aparelho, sem enviar dados. A importação real
        depende de conciliação, proteção de bloqueios e operação administrativa homologada.
      </p>
      <input type="file" accept=".csv,text/csv" aria-label="Selecionar CSV para análise local"
        className="max-w-full text-sm text-foreground"
        onChange={(event) => void inspectImport(event.target.files?.[0])} />
      {csvInfo && <p role="status" className="text-sm text-muted-foreground">{csvInfo}</p>}
    </fieldset>
  </section>;
}
