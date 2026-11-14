import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { guiafixAdminSourceId, normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";
import { technicianDisplayName } from "@/lib/admin-technician-display-name";
import { publicTextProblem } from "@/lib/public-profile-text";
import { AdminTechnicianManager } from "@/components/admin-technician-manager";
import { AdminTechnicianRecordEditor, type AdminTechnicianRegistryRecord } from "@/components/admin-technician-record-editor";
import { Link } from "@tanstack/react-router";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { categoryKeyword, UNIFIED_DIRECTORY_PAGE_SIZE, unifiedPageCount, unifiedPageSlice } from "@/lib/admin-unified-pagination";

// The three imports are independent sources, NOT additional approved accounts.
// Admin-only public fields; never query telephone, e-mail or private contacts here.
const captures = import.meta.glob("../../data/external-staging/guiafix-*.capture.json", {
  eager: true, import: "default",
}) as Record<string, unknown>;
const guiafix = readGuiafixStaging(Object.values(captures));
const db = supabase as unknown as SupabaseClient;
const FETCH_CHUNK = 200;

type DirectoryRow = {
  key: string;
  portalId?: string;
  wpPostId?: number;
  registry?: AdminTechnicianRegistryRecord;
  name: string;
  location: string;
  regionKey?: string | undefined;
  specialty: string | null;
  createdAt?: string;
  origin: "portal" | "wordpress" | "guiafix" | "manual" | "other_import";
  recordState?: string | undefined;
  demo?: boolean;
};

// PostgREST `or` filtering is structural syntax: only safe search characters enter it.
export function cleanUnifiedSearch(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").slice(0, 80).trim();
}

export function AdminTechnicianUnifiedDirectory({ adminOwnerId }: { adminOwnerId: string }) {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [regionDraft, setRegionDraft] = useState("");
  const [specialtyDraft, setSpecialtyDraft] = useState("");
  const [region, setRegion] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "rows" | "grid">("rows");
  const [sortMode, setSortMode] = useState<"name_asc" | "name_desc" | "newest">("name_asc");
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
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
  const [importKey, setImportKey] = useState<string | null>(null);
  const [correctedName, setCorrectedName] = useState("");
  const [reason, setReason] = useState("");
  const [wpAction, setWpAction] = useState<"corrigir_nome" | "arquivar" | "restaurar">("corrigir_nome");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { categories } = useActiveCategories();
  const specialtyTerm = categoryKeyword(specialty);
  const matchedSlugs = useMemo(() => specialtyTerm
    ? categories.filter((item) => normalizeGuiafixSearch(`${item.slug} ${item.label}`)
      .includes(specialtyTerm)).map((item) => item.slug)
    : [], [categories, specialtyTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(cleanUnifiedSearch(draft));
      setRegion(cleanUnifiedSearch(regionDraft));
      setSpecialty(cleanUnifiedSearch(specialtyDraft));
      setPage(0);
      setCheckedKeys([]);
      setSelectedKey(null);
      setImportKey(null);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [draft, regionDraft, specialtyDraft]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    async function load() {
      // The merged page needs only the first N sorted rows from EACH source.
      // Fetch in 200-row chunks to avoid PostgREST's 1,000-row response cap.
      const needed = (page + 1) * UNIFIED_DIRECTORY_PAGE_SIZE;
      let matchedIds: number[] = [];
      if (term) {
        // The historical title is immutable. Searching only that field would lose
        // technicians after an admin saves a corrected display name in the overlay.
        const correctedNames = await db.from("eut_legacy_profile_management")
          .select("wp_post_id")
          .eq("source_key", "wordpress_20261108")
          .ilike("corrected_name", `%${term}%`)
          .limit(1000);
        if (!current) return;
        if (correctedNames.error) throw new Error("correction search unavailable");
        matchedIds = (correctedNames.data ?? []).map((item) => item.wp_post_id)
          .filter((id): id is number => Number.isSafeInteger(id) && id >= 0);
      }

      async function loadPortal() {
        const rows: DirectoryRow[] = [];
        let total = 0;
        for (let start = 0; start < needed && current; start += FETCH_CHUNK) {
          let query = db.from("technicians")
            .select("id,display_name,city,state_uf,region,specialties,status,created_at", { count: "exact" });
          if (term) query = query.ilike("display_name", `%${term}%`);
          if (region) query = region.length === 2 ? query.eq("state_uf", region.toUpperCase())
            : query.or(["city", "region"].map((field) => `${field}.ilike.%${region}%`).join(","));
          if (specialtyTerm) query = query.overlaps("specialties", matchedSlugs);
          const result = await query
            .order(recentOnly ? "created_at" : "display_name", { ascending: !recentOnly })
            .order("id").range(start, Math.min(start + FETCH_CHUNK, needed) - 1);
          if (result.error) throw new Error("portal directory unavailable");
          total = result.count ?? 0;
          rows.push(...(result.data ?? []).map((item): DirectoryRow => ({
            key: `portal:${item.id}`, portalId: item.id,
            name: item.display_name || "Técnico sem nome de exibição",
            location: [item.city, item.state_uf].filter(Boolean).join("/") || item.region || "Localidade não informada",
            regionKey: item.city || item.state_uf || undefined,
            specialty: item.specialties?.join(", ") || null,
            createdAt: item.created_at, origin: "portal",
          })));
          if (!result.data?.length || rows.length >= total) break;
        }
        return { rows, total };
      }

      async function loadWordPress() {
        if (recentOnly) return { rows: [] as DirectoryRow[], total: 0 };
        const rows: DirectoryRow[] = [];
        let total = 0;
        for (let start = 0; start < needed && current; start += FETCH_CHUNK) {
          let query = db.from("legacy_review_profiles")
            .select("source_key,wp_post_id,kind,title,specialty_title,location1,location2,location3,demo_candidate", { count: "exact" })
            .eq("source_key", "wordpress_20261108").eq("kind", "candidate");
          if (term) {
            const searchFields = ["title", "location1", "location2", "location3"]
              .map((field) => `${field}.ilike.%${term}%`);
            if (matchedIds.length) searchFields.push(`wp_post_id.in.(${matchedIds.join(",")})`);
            query = query.or(searchFields.join(","));
          }
          if (region) query = query.or(["location1", "location2", "location3"]
            .map((field) => `${field}.ilike.%${region}%`).join(","));
          if (specialtyTerm) query = query.ilike("specialty_title", `%${specialtyTerm}%`);
          const result = await query.order("title").order("wp_post_id")
            .range(start, Math.min(start + FETCH_CHUNK, needed) - 1);
          if (result.error) throw new Error("WordPress directory unavailable");
          total = result.count ?? 0;
          rows.push(...(result.data ?? []).map((item): DirectoryRow => {
            const locations = [item.location1, item.location2, item.location3].filter(Boolean) as string[];
            const specific = locations.find((loc) => loc.toLowerCase() !== "brasil");
            return {
              key: `wp:${item.kind}:${item.wp_post_id}`, wpPostId: item.wp_post_id,
              name: technicianDisplayName(item.title || "Técnico sem nome recuperado", specific?.split("/")[0]?.trim()),
              location: locations.join(" · ") || "Localidade não confirmada",
              regionKey: specific?.split("/")[0]?.trim(),
              specialty: item.specialty_title || null,
              origin: "wordpress", demo: item.demo_candidate,
            };
          }));
          if (!result.data?.length || rows.length >= total) break;
        }
        return { rows, total };
      }

      const [portal, wp] = await Promise.all([loadPortal(), loadWordPress()]);
      if (!current) return;
      const corrected = new Map<number, { corrected_name: string | null; record_state: string | null }>();
      const wpIds = wp.rows.map((item) => item.wpPostId).filter((id): id is number => id !== undefined);
      for (let start = 0; start < wpIds.length && current; start += FETCH_CHUNK) {
        const corrections = await db.from("eut_legacy_profile_management")
          .select("wp_post_id,corrected_name,record_state")
          .eq("source_key", "wordpress_20261108")
          .in("wp_post_id", wpIds.slice(start, start + FETCH_CHUNK));
        if (corrections.error) throw new Error("historical review unavailable");
        for (const item of corrections.data ?? []) corrected.set(item.wp_post_id, item);
      }
      if (!current) return;
      setOperational(portal.rows);
      setOperationalTotal(portal.total);
      setLegacy(wp.rows.map((row) => ({
        ...row,
        name: corrected.get(row.wpPostId ?? -1)?.corrected_name || row.name,
        recordState: corrected.get(row.wpPostId ?? -1)?.record_state ?? undefined,
      })));
      setLegacyTotal(wp.total);
      setLoading(false);
    }
    void load().catch(() => { if (current) {
      setOperational([]); setLegacy([]); setFailed(true); setLoading(false);
    } });
    return () => { current = false; };
  }, [term, region, specialtyTerm, matchedSlugs, page, recentOnly, reload]);

  useEffect(() => {
    let current = true;
    setRegistryLoading(true);
    async function loadRegistry() {
      const fetched: AdminTechnicianRegistryRecord[] = [];
      // The registry RPC has a strict 100-row maximum per call.
      // With locality/specialty filters, read all matching-by-name records so
      // the client does not silently omit later matching category/region rows.
      const needAll = Boolean(region || specialtyTerm);
      const wanted = needAll ? Number.POSITIVE_INFINITY : (page + 1) * UNIFIED_DIRECTORY_PAGE_SIZE;
      let total = 0;
      for (let offset = 0; offset < wanted && current; offset += 100) {
        const { data, error } = await db.rpc("eut_admin_technician_registry_list", {
          _search: term, _limit: Math.min(100, wanted - offset), _offset: offset,
        });
        if (error) throw error;
        const rows = (data ?? []) as AdminTechnicianRegistryRecord[];
        total = rows[0] ? Number(rows[0].total_count) || 0 : total;
        fetched.push(...rows);
        if (!rows.length || fetched.length >= total) break;
      }
      return { fetched, total };
    }
    void loadRegistry().then(({ fetched, total }) => {
      if (!current) return;
      setRegistryLoading(false);
      setRegistryAvailable(true);
      setRegistryError(null);
      setRegistry(fetched);
      setRegistryTotal(total);
    }).catch((error: { code?: string }) => {
      if (!current) return;
      setRegistryLoading(false);
      setRegistryAvailable(false);
      setRegistry([]);
      setRegistryTotal(0);
      const absent = error?.code === "PGRST202" || error?.code === "42883";
      setRegistryError(absent
        ? "Cadastro manual ainda não ativado no banco. A listagem existente continua disponível."
        : "Sem conexão com a API administrativa; nenhuma gravação está habilitada.");
    });
    return () => { current = false; };
  }, [term, region, specialtyTerm, page, reload]);

  function refreshAfterSaved() {
    // Requery authoritative server values after an audited write. The selected
    // card may have changed its sort position or name and must not stay stale.
    setSelectedKey(null);
    setImportKey(null);
    setManualSourceId(null);
    setPage(0);
    setReload((version) => version + 1);
    setFeedback("Alteração confirmada. Atualizando a listagem de técnicos…");
  }

  const guiafixResults = useMemo(() => recentOnly ? [] : guiafix.filter((row) =>
    (!term || normalizeGuiafixSearch(`${row.name} ${row.city} ${row.uf}`)
      .includes(normalizeGuiafixSearch(term))) &&
    (!region || normalizeGuiafixSearch(`${row.city} ${row.uf}`)
      .includes(normalizeGuiafixSearch(region))) &&
    (!specialtyTerm || normalizeGuiafixSearch(row.category).includes(specialtyTerm))
  ).map((row): DirectoryRow => ({
    key: guiafixAdminSourceId(row.key), name: technicianDisplayName(row.name, row.city), location: `${row.city}/${row.uf}`,
    regionKey: row.city, specialty: row.category, origin: "guiafix",
  })), [term, region, specialtyTerm, recentOnly]);
  const merged = useMemo(() => {
    const importedWp = new Set(registry.filter((r) => r.origin === "wordpress").map((r) => r.source_id));
    const importedGuiafix = new Set(registry.filter((r) => r.origin === "guiafix").map((r) => r.source_id));
    const registryRows: DirectoryRow[] = recentOnly ? [] : registry.filter((item) =>
      (!region || normalizeGuiafixSearch(`${item.region_approx ?? ""} ${item.ddd ?? ""} ${item.city_ibge_id ?? ""}`)
        .includes(normalizeGuiafixSearch(region))) &&
      (!specialtyTerm || item.category_slugs.some((slug) => normalizeGuiafixSearch(slug).includes(specialtyTerm)))
    ).map((item) => ({
      key: `registry:${item.technician_id}`, registry: item,
      name: technicianDisplayName(item.display_name, item.region_approx), origin: item.origin,
      location: [item.region_approx, item.ddd ? `DDD ${item.ddd}` : null,
        item.city_ibge_id ? `IBGE ${item.city_ibge_id}` : null].filter(Boolean).join(" · ") || "Localidade não informada",
      regionKey: item.region_approx || undefined,
      specialty: item.category_slugs.join(" · ") || null,
      demo: item.is_demo,
    }));
    const legacyUnlinked = legacy.filter((item) => !importedWp.has(`wordpress_20261108:${item.wpPostId}`));
    const guiafixUnlinked = guiafixResults.filter((item) => !importedGuiafix.has(item.key));
    const rows = [...operational,
      ...legacyUnlinked,
      ...guiafixUnlinked,
      ...registryRows];
    rows.sort((a, b) => recentOnly
      ? (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0)
      : a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key));
    return { rows, importedCount: legacy.length - legacyUnlinked.length + guiafixResults.length - guiafixUnlinked.length,
      registryFilteredCount: registryRows.length };
  }, [operational, legacy, guiafixResults, registry, region, specialtyTerm, recentOnly]);
  const results = useMemo(() => unifiedPageSlice(merged.rows, page), [merged, page]);
  const registryCount = recentOnly ? 0 : region || specialtyTerm ? merged.registryFilteredCount : registryAvailable ? registryTotal : 0;
  const total = operationalTotal === null || legacyTotal === null ? null
    : Math.max(0, operationalTotal + legacyTotal + guiafixResults.length + registryCount - (recentOnly ? 0 : merged.importedCount));
  const exactTotal = operationalTotal !== null && legacyTotal !== null &&
    operational.length >= operationalTotal && legacy.length >= legacyTotal &&
    (!registryAvailable || registry.length >= registryTotal);
  const pages = unifiedPageCount(total ?? 0);
  // Sorting is explicitly limited to the loaded page. Server pagination remains authoritative.
  const visibleRows = useMemo(() => [...results].sort((a, b) => {
    if (sortMode === "newest") {
      const dateDelta = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      if (dateDelta !== 0) return dateDelta;
    }
    return sortMode === "name_desc"
      ? b.name.localeCompare(a.name, "pt-BR")
      : a.name.localeCompare(b.name, "pt-BR");
  }), [results, sortMode]);
  const checkedVisible = visibleRows.filter((row) => checkedKeys.includes(row.key));
  function toggleChecked(key: string) {
    setCheckedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }
  async function copyCheckedNames() {
    if (checkedVisible.length === 0) return;
    try {
      await navigator.clipboard.writeText(checkedVisible.map((row) => row.name).join("\n"));
      setFeedback(`${checkedVisible.length} nomes copiados, sem dados de contato.`);
    } catch {
      setFeedback("Não foi possível copiar automaticamente. Verifique a permissão da área de transferência.");
    }
  }

  function filterRegion(value: string) {
    setRegionDraft(value); setRegion(cleanUnifiedSearch(value)); setPage(0); setSelectedKey(null); setImportKey(null);
  }
  function filterSpecialty(value: string) {
    setSpecialtyDraft(value); setSpecialty(cleanUnifiedSearch(value)); setPage(0); setSelectedKey(null); setImportKey(null);
  }

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
    if (row.demo) return;
    if (selectedKey === row.key) {
      setSelectedKey(null);
      setImportKey(null);
      return;
    }
    setSelectedKey(row.key);
    setImportKey(!row.registry && (row.origin === "wordpress" || row.origin === "guiafix") && registryAvailable
      ? row.key : null);
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
    } catch {
      // PostgREST errors may echo the payload; never render a private contact or SQL data.
      setFeedback("Não foi possível salvar esta ficha. Confira os dados, a justificativa e sua permissão administrativa.");
    } finally {
      setSaving(false);
    }
  }

  return <section id="admin-unified-directory" className="mt-6 min-w-0 scroll-mt-24 rounded-2xl border border-primary/20 bg-card p-3 sm:p-6" aria-label="Busca unificada de técnicos">
    <h2 className="text-xl font-bold text-foreground">Todos os técnicos</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Encontre o profissional pelo nome, região ou categoria. Toque em Editar técnico para atualizar
      nome, cidade, especialidades e contato privado no celular ou computador.
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
    <div role="group" aria-label="Navegação entre técnicos" className="mt-4 flex flex-wrap gap-2">
      <button type="button" aria-pressed={!recentOnly} onClick={() => { setRecentOnly(false); setPage(0); setSelectedKey(null); setImportKey(null); }}
        className={"min-h-11 rounded-lg border px-4 text-sm font-semibold " + (!recentOnly ? "bg-primary text-primary-foreground" : "border-input text-foreground")}>
        Todos os técnicos
      </button>
      <button type="button" aria-pressed={recentOnly} onClick={() => { setRecentOnly(true); setPage(0); setSelectedKey(null); setImportKey(null); }}
        className={"min-h-11 rounded-lg border px-4 text-sm font-semibold " + (recentOnly ? "bg-primary text-primary-foreground" : "border-input text-foreground")}>
        Últimos cadastros
      </button>
      <Link to="/admin/$secao" params={{ secao: "catalogo" }}
        className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 text-sm font-semibold text-primary">
        Categorias e serviços
      </Link>
    </div>
    {recentOnly && <p className="mt-2 text-xs text-muted-foreground">Exibindo técnicos com data de cadastro confirmada. Registros sem data não são ordenados artificialmente.</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-1 text-sm font-semibold text-foreground">Nome
        <input id="admin-unified-technician-search" value={draft} onChange={(event) => setDraft(event.target.value)}
          maxLength={80} placeholder="Buscar por nome" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Cidade, região ou UF
        <input value={regionDraft} onChange={(event) => setRegionDraft(event.target.value)}
          maxLength={80} placeholder="Ex.: Curitiba ou PR" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Categoria ou especialidade
        <input value={specialtyDraft} onChange={(event) => setSpecialtyDraft(event.target.value)}
          maxLength={80} placeholder="Ex.: informática" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground" />
      </label>
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-3" aria-label="Organizar visualização">
      <label className="grid gap-1 text-xs font-semibold text-foreground">Exibição
        <select value={viewMode} onChange={(event) => setViewMode(event.target.value as typeof viewMode)}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="rows">Linhas compactas</option><option value="cards">Cartões</option><option value="grid">Grade</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-foreground">Ordenar esta página
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="name_asc">Nome A–Z</option><option value="name_desc">Nome Z–A</option><option value="newest">Cadastro recente (quando informado)</option>
        </select>
      </label>
      <button type="button" onClick={() => setCheckedKeys(visibleRows.map((row) => row.key))}
        className="min-h-11 rounded-lg border border-input px-3 text-sm">Selecionar página</button>
      <button type="button" onClick={() => setCheckedKeys([])} disabled={checkedKeys.length === 0}
        className="min-h-11 rounded-lg border border-input px-3 text-sm disabled:opacity-50">Limpar seleção</button>
      <button type="button" onClick={() => void copyCheckedNames()} disabled={checkedVisible.length === 0}
        className="min-h-11 rounded-lg border border-primary/40 px-3 text-sm font-semibold text-primary disabled:opacity-50">
        Copiar nomes ({checkedVisible.length})
      </button>
      <span className="w-full text-xs text-muted-foreground">A seleção e a ordenação se aplicam à página atual. Nenhuma ação em lote altera cadastros ou contatos.</span>
    </div>
    {(region || specialty) && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Filtros ativos:</span>
      {region && <button type="button" onClick={() => filterRegion("")} className="min-h-9 rounded-full border border-input px-3">Região: {region} ×</button>}
      {specialty && <button type="button" onClick={() => filterSpecialty("")} className="min-h-9 rounded-full border border-input px-3">Especialidade: {specialty} ×</button>}
    </div>}
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {loading || registryLoading ? "Consultando registros…" : failed ? "Consulta incompleta: verifique a permissão ou conexão." :
        `${total === null ? "Total indisponível" : (exactTotal ? "" : "cerca de ") + total.toLocaleString("pt-BR") + " referências"} · página ${page + 1} de ${pages} · até ${UNIFIED_DIRECTORY_PAGE_SIZE} registros por página`}
    </p>
    {feedback && <p role="status" className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">{feedback}</p>}
    {!loading && !registryLoading && !failed && <ul className={"mt-4 grid min-w-0 gap-3 " + (viewMode === "cards" ? "sm:grid-cols-2" : viewMode === "grid" ? "sm:grid-cols-2 xl:grid-cols-3" : "")}>
      {visibleRows.map((row) => <li key={row.key} className={"min-w-0 rounded-xl border border-border bg-background " + (viewMode === "rows" ? "p-2 sm:p-3" : "p-3 sm:p-4")}>
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <input type="checkbox" aria-label={`Selecionar ${row.name}`} checked={checkedKeys.includes(row.key)}
              onChange={() => toggleChecked(row.key)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
            <div className="min-w-0">
            <strong className="break-words text-foreground">{row.name}</strong>
            {row.regionKey ? <button type="button" onClick={() => filterRegion(row.regionKey ?? "")}
              className="mt-1 min-h-9 break-words text-left text-sm text-primary underline-offset-2 hover:underline"
              title="Encontrar outros técnicos nesta região">{row.location}</button>
              : <p className="mt-1 text-sm text-muted-foreground">{row.location}</p>}
            {row.specialty && <button type="button" onClick={() => filterSpecialty(categoryKeyword(row.specialty ?? ""))}
              className="mt-1 min-h-9 break-words text-left text-xs text-primary underline-offset-2 hover:underline"
              title="Encontrar especialidades semelhantes">{row.specialty}</button>}
            {row.demo && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Demonstração protegida: indisponível para ativação.</p>}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {!row.demo &&
              <button type="button" onClick={() => selectRow(row)} aria-expanded={selectedKey === row.key}
                className="min-h-11 w-full shrink-0 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 sm:w-auto">
                {selectedKey === row.key ? "Fechar edição" : "Editar técnico"}
              </button>}
          </div>
        </div>
        {row.registry && <p className="mt-2 text-xs text-muted-foreground">
          {row.registry.archived ? "Registro arquivado" : row.registry.admin_active ? "Registro administrativo ativo" : "Registro administrativo não ativo"}
          {row.registry.contact_last4 ? ` · Contato privado final ${row.registry.contact_last4}` : ""}
        </p>}
        {selectedKey === row.key && row.registry &&
          <AdminTechnicianRecordEditor key={row.registry.technician_id + row.registry.updated_at}
            sourceId={row.registry.source_id} existing={row.registry} available={registryAvailable}
            onCancel={() => setSelectedKey(null)}
            onSaved={(message) => { refreshAfterSaved(); setFeedback(message); }} />}
        {selectedKey === row.key && importKey === row.key && row.wpPostId !== undefined && !row.demo && !row.registry &&
          <AdminTechnicianRecordEditor key={`wp-import:${row.wpPostId}`}
            sourceId={`wordpress_20261108:${row.wpPostId}`} createOrigin="wordpress"
            importedName={row.name} importedDemo={Boolean(row.demo)} available={registryAvailable}
            onCancel={() => { setImportKey(null); setSelectedKey(null); }}
            onSaved={(message) => { refreshAfterSaved(); setDraft(row.name); setFeedback(message); }} />}
        {selectedKey === row.key && importKey === row.key && !row.demo && !row.registry && row.origin === "guiafix" &&
          <AdminTechnicianRecordEditor key={row.key} sourceId={row.key} createOrigin="guiafix"
            importedName={row.name} available={registryAvailable}
            onCancel={() => { setImportKey(null); setSelectedKey(null); }}
            onSaved={(message) => { refreshAfterSaved(); setDraft(row.name); setFeedback(message); }} />}
        {selectedKey === row.key && row.portalId && !row.registry &&
          <div className="mt-4 border-t border-border pt-4">
            <AdminTechnicianManager adminOwnerId={adminOwnerId} selectedTechnicianId={row.portalId}
              onUpdated={refreshAfterSaved} />
          </div>}
        {selectedKey === row.key && importKey !== row.key && row.wpPostId !== undefined && !row.registry && !row.demo &&
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
              Se a edição completa estiver temporariamente indisponível, esta ação salva a correção
              do nome com auditoria. Os demais dados permanecem preservados.
            </p>
            <button type="submit" disabled={saving}
              className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
              {saving ? "Gravando…" : wpAction === "corrigir_nome" ? "Salvar nome no banco" :
                wpAction === "arquivar" ? "Confirmar arquivamento" : "Confirmar restauração"}
            </button>
          </form>}
        {selectedKey === row.key && row.origin === "guiafix" && !registryAvailable && !row.registry &&
          <p role="alert" className="mt-3 rounded-lg border border-amber-500/40 p-3 text-sm text-foreground">
            A edição desta ficha depende da ativação da API administrativa no banco. Nenhuma alteração foi simulada.
          </p>}
      </li>)}
    </ul>}
    {!loading && !registryLoading && !failed && results.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nenhum registro corresponde à busca.</p>}
    {!loading && !registryLoading && !failed && total !== null && total > 0 && <nav aria-label="Paginação do diretório unificado"
      className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <button type="button" disabled={page === 0} onClick={() => { setPage((current) => Math.max(0, current - 1)); setSelectedKey(null); setImportKey(null); setCheckedKeys([]); }}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-40">Anterior</button>
      <label className="flex items-center gap-2 text-sm text-foreground">Página
        <select aria-label="Ir para a página" value={page} onChange={(event) => { setPage(Number(event.target.value)); setSelectedKey(null); setImportKey(null); setCheckedKeys([]); }}
          className="min-h-11 rounded-lg border border-input bg-background px-3">
          {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} de {pages}</option>)}
        </select>
      </label>
      <button type="button" disabled={page + 1 >= pages} onClick={() => { setPage((current) => Math.min(pages - 1, current + 1)); setSelectedKey(null); setImportKey(null); setCheckedKeys([]); }}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-40">Próxima</button>
    </nav>}
    <p className="mt-4 text-xs text-muted-foreground">
      Cadastro manual e edição avançada usam a API administrativa protegida; quando indisponível, o formulário bloqueia a gravação.
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
