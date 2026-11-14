import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { guiafixAdminSourceId, normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";
import { technicianDisplayName } from "@/lib/admin-technician-display-name";
import { publicTextProblem } from "@/lib/public-profile-text";
import { AdminTechnicianManager } from "@/components/admin-technician-manager";
import { AdminTechnicianRecordEditor, type AdminTechnicianRegistryRecord } from "@/components/admin-technician-record-editor";
import { TechnicianAvatar } from "@/components/technician-avatar";
import { Link } from "@tanstack/react-router";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { categoryKeyword, UNIFIED_DIRECTORY_PAGE_SIZE, unifiedPageCount, unifiedPageSlice } from "@/lib/admin-unified-pagination";
import { canBulkAct, orderTechnicians, technicianState, type TechnicianBulkAction,
  type TechnicianSortMode, type TechnicianStateFilter, type TechnicianViewMode } from "@/lib/admin-technician-directory-view";
import { Grid2X2, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { csvImportErrorText, prepareTechnicianCsv, type TechnicianImportRow } from "@/lib/admin-technician-csv-import";

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
  updatedAt?: string;
  avatarPath?: string | null;
  portalStatus?: "pendente" | "aprovado" | "suspenso" | "rejeitado";
  cityIbgeId?: number;
  origin: "portal" | "wordpress" | "guiafix" | "manual" | "other_import";
  recordState?: string | undefined;
  demo?: boolean;
};

// PostgREST `or` filtering is structural syntax: only safe search characters enter it.
export function cleanUnifiedSearch(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").slice(0, 80).trim();
}

export function AdminTechnicianUnifiedDirectory({ adminOwnerId }: { adminOwnerId: string }) {
  const [draft, setDraft] = useState(() => typeof window === "undefined" ? "" :
    cleanUnifiedSearch(new URLSearchParams(window.location.search).get("q") ?? ""));
  const [term, setTerm] = useState(draft);
  const [regionDraft, setRegionDraft] = useState("");
  const [specialtyDraft, setSpecialtyDraft] = useState("");
  const [region, setRegion] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [sort, setSort] = useState<TechnicianSortMode>("name-asc");
  const [stateFilter, setStateFilter] = useState<TechnicianStateFilter>("all");
  const [view, setView] = useState<TechnicianViewMode>("rows");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<TechnicianBulkAction | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [legacy, setLegacy] = useState<DirectoryRow[]>([]);
  const [operational, setOperational] = useState<DirectoryRow[]>([]);
  const [registry, setRegistry] = useState<AdminTechnicianRegistryRecord[]>([]);
  const [municipalityNames, setMunicipalityNames] = useState<Record<number, string>>({});
  const [legacyTotal, setLegacyTotal] = useState<number | null>(null);
  const [operationalTotal, setOperationalTotal] = useState<number | null>(null);
  const [registryTotal, setRegistryTotal] = useState(0);
  const [registryAvailable, setRegistryAvailable] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [manualSourceId, setManualSourceId] = useState<string | null>(null);
  const [csvInfo, setCsvInfo] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<TechnicianImportRow[]>([]);
  const [csvReason, setCsvReason] = useState("");
  const [csvAcknowledged, setCsvAcknowledged] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
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
      setSelectedKey(null);
      setImportKey(null);
      setSelected(new Set());
      setDetailKey(null);
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
      // Alternate sorts and status filters require the whole matching candidate set;
      // otherwise a name-sorted prefix would give false ordering/empty pages.
      const needed = sort === "name-asc" && stateFilter === "all" && !region && !specialtyTerm
        ? (page + 1) * UNIFIED_DIRECTORY_PAGE_SIZE : 10000;
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
            .select("id,display_name,city,state_uf,region,specialties,status,created_at,updated_at,avatar_path", { count: "exact" });
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
            createdAt: item.created_at, updatedAt: item.updated_at,
            avatarPath: item.avatar_path, portalStatus: item.status, origin: "portal",
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
            const locations = [...new Set(([item.location1, item.location2, item.location3]
              .filter(Boolean) as string[]).map((value) => value.trim())
              .filter((value) => value.toLocaleLowerCase("pt-BR") !== "brasil"))];
            const specific = locations[0];
            return {
              key: `wp:${item.kind}:${item.wp_post_id}`, wpPostId: item.wp_post_id,
              name: technicianDisplayName(item.title || "Técnico sem nome recuperado", specific?.split("/")[0]?.trim()),
              location: locations.join(" · ") || "Localidade não informada",
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
  }, [term, region, specialtyTerm, matchedSlugs, page, recentOnly, sort, stateFilter, reload]);

  useEffect(() => {
    let current = true;
    setRegistryLoading(true);
    async function loadRegistry() {
      const fetched: AdminTechnicianRegistryRecord[] = [];
      // The registry RPC has a strict 100-row maximum per call.
      // With locality/specialty filters, read all matching-by-name records so
      // the client does not silently omit later matching category/region rows.
      const needAll = Boolean(region || specialtyTerm || sort !== "name-asc" || stateFilter !== "all");
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
  }, [term, region, specialtyTerm, page, sort, stateFilter, reload]);

  useEffect(() => {
    const ids = [...new Set(registry.map((item) => item.city_ibge_id).filter((id): id is number => id !== null))];
    if (!ids.length) { setMunicipalityNames({}); return; }
    let current = true;
    void Promise.resolve(db.from("eut_ibge_municipalities")
      .select("id,name,uf").in("id", ids.slice(0, 1000)))
      .then(({ data }) => { if (current) setMunicipalityNames(Object.fromEntries(
        (data ?? []).map((city: { id: number; name: string; uf: string }) =>
          [city.id, `${city.name}/${city.uf}`]))); })
      .catch(() => { if (current) setMunicipalityNames({}); });
    return () => { current = false; };
  }, [registry]);

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
    regionKey: row.city, cityIbgeId: row.cityIbgeId, specialty: row.category, origin: "guiafix",
  })), [term, region, specialtyTerm, recentOnly]);
  const merged = useMemo(() => {
    const importedWp = new Set(registry.filter((r) => r.origin === "wordpress").map((r) => r.source_id));
    const importedGuiafix = new Set(registry.filter((r) => r.origin === "guiafix").map((r) => r.source_id));
    const registryRows: DirectoryRow[] = recentOnly ? [] : registry.filter((item) =>
      (!region || normalizeGuiafixSearch(`${item.region_approx ?? ""} ${municipalityNames[item.city_ibge_id ?? -1] ?? ""} ${item.ddd ?? ""} ${item.city_ibge_id ?? ""}`)
        .includes(normalizeGuiafixSearch(region))) &&
      (!specialtyTerm || item.category_slugs.some((slug) => normalizeGuiafixSearch(slug).includes(specialtyTerm)))
    ).map((item) => ({
      key: `registry:${item.technician_id}`, registry: item,
      name: technicianDisplayName(item.display_name, item.region_approx), origin: item.origin,
      location: [...new Set([municipalityNames[item.city_ibge_id ?? -1], item.region_approx,
        item.ddd ? `DDD ${item.ddd}` : null].filter(Boolean))].join(" · ") || "Localidade não informada",
      regionKey: municipalityNames[item.city_ibge_id ?? -1]?.split("/")[0] || item.region_approx || undefined,
      specialty: item.category_slugs.join(" · ") || null,
      updatedAt: item.updated_at,
      demo: item.is_demo,
    }));
    const legacyUnlinked = legacy.filter((item) => !importedWp.has(`wordpress_20261108:${item.wpPostId}`));
    const guiafixUnlinked = guiafixResults.filter((item) => !importedGuiafix.has(item.key));
    const rows = [...operational,
      ...legacyUnlinked,
      ...guiafixUnlinked,
      ...registryRows];
    const ordered = orderTechnicians(rows.filter((row) => stateFilter === "all" || technicianState(row) === stateFilter),
      recentOnly ? "newest" : sort);
    return { rows: ordered, importedCount: legacy.length - legacyUnlinked.length + guiafixResults.length - guiafixUnlinked.length,
      registryFilteredCount: registryRows.length };
  }, [operational, legacy, guiafixResults, registry, municipalityNames, region, specialtyTerm, recentOnly, sort, stateFilter]);
  const results = useMemo(() => unifiedPageSlice(merged.rows, page), [merged, page]);
  const registryCount = recentOnly ? 0 : region || specialtyTerm ? merged.registryFilteredCount : registryAvailable ? registryTotal : 0;
  const sourceTotal = operationalTotal === null || legacyTotal === null ? null
    : Math.max(0, operationalTotal + legacyTotal + guiafixResults.length + registryCount - (recentOnly ? 0 : merged.importedCount));
  const exactTotal = operationalTotal !== null && legacyTotal !== null &&
    operational.length >= operationalTotal && legacy.length >= legacyTotal &&
    (!registryAvailable || registry.length >= registryTotal);
  const allLoaded = exactTotal && !loading && !registryLoading;
  const total = stateFilter !== "all" || allLoaded ? (allLoaded ? merged.rows.length : null) : sourceTotal;
  const pages = unifiedPageCount(total ?? 0);
  const selectedRows = results.filter((row) => selected.has(row.key));
  const selectableRows = results.filter((row) => !row.demo);
  const selectedAll = selectableRows.length > 0 && selectableRows.every((row) => selected.has(row.key));

  useEffect(() => {
    setSelected(new Set());
    setBulkAction(null);
    setDetailKey(null);
  }, [page, sort, stateFilter, recentOnly, region, specialty]);

  function toggleSelected(key: string) {
    setSelected((before) => {
      const next = new Set(before);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function togglePageSelection() {
    setSelected(selectedAll ? new Set() : new Set(selectableRows.map((row) => row.key)));
  }

  async function runBulk(event: FormEvent) {
    event.preventDefault();
    if (!bulkAction || bulkBusy || bulkReason.trim().length < 8 || bulkReason.trim().length > 400) return;
    const actionable = selectedRows.filter((row) => canBulkAct(row, bulkAction));
    if (!actionable.length) return;
    const skipped = selectedRows.length - actionable.length;
    const operation = bulkAction === "import" ? "cadastrar para edição" : bulkAction === "archive"
      ? "arquivar ou suspender" : "restaurar ou reativar";
    if (!window.confirm(`Confirmar ${operation} em ${actionable.length} técnico(s) desta página? ${skipped ? `${skipped} ficha(s) sem ação compatível serão ignoradas. ` : ""}Cada alteração será auditada e poderá resultar em êxito ou falha individual.`)) return;
    setBulkBusy(true);
    setFeedback(null);
    let done = 0;
    let failures = 0;
    for (const row of actionable) {
      try {
        if (bulkAction === "import") {
          const origin = row.origin as "wordpress" | "guiafix";
          const sourceId = origin === "wordpress" ? `wordpress_20261108:${row.wpPostId}` : row.key;
          const { data, error } = await db.rpc("eut_admin_technician_record_save", {
            _origin: origin, _source_id: sourceId, _expected_updated_at: null,
            _payload: {
              display_name: row.name, city_ibge_id: row.cityIbgeId ?? null, ddd: null,
              region_approx: row.regionKey?.slice(0, 120) || null,
              category_slugs: [], service_slugs: [], admin_active: false,
              is_demo: false, phone_action: "keep",
            }, _reason: bulkReason.trim(),
          });
          if (error || data?.ok !== true) throw new Error("not_confirmed");
        } else if (row.registry) {
          const { data, error } = await db.rpc("eut_admin_technician_record_archive", {
            _technician_id: row.registry.technician_id,
            _expected_updated_at: row.registry.updated_at,
            _action: bulkAction === "archive" ? "archive" : "restore",
            _reason: bulkReason.trim(),
          });
          if (error || data?.ok !== true) throw new Error("not_confirmed");
        } else if (row.portalId) {
          const intendedStatus = bulkAction === "archive" ? "suspenso" : "aprovado";
          const { data, error } = await db.rpc("eut_admin_technician_action", {
            p_id: row.portalId, p_action: bulkAction === "archive" ? "suspender" : "reativar",
            p_value: {}, p_reason: bulkReason.trim(),
          });
          if (error || data?.id !== row.portalId || data?.status !== intendedStatus)
            throw new Error("not_confirmed");
        } else if (row.wpPostId !== undefined) {
          const { data, error } = await db.rpc("eut_admin_legacy_action", {
            p_ids: [row.wpPostId], p_action: bulkAction === "archive" ? "arquivar" : "restaurar",
            p_value: "", p_reason: bulkReason.trim(),
          });
          if (error || data?.updated !== 1 || data?.published !== false)
            throw new Error("not_confirmed");
        } else throw new Error("unsupported");
        done += 1;
      } catch {
        failures += 1;
      }
    }
    setBulkBusy(false);
    setBulkAction(null);
    setBulkReason("");
    setSelected(new Set());
    if (done) refreshAfterSaved();
    setFeedback(`${done} alteração(ões) confirmada(s) no banco. ${failures ? `${failures} não concluída(s); nenhuma delas foi presumida como salva. ` : ""}${skipped ? `${skipped} ficha(s) sem ação compatível foram ignoradas.` : ""}`);
  }

  function formatDate(value?: string): string {
    if (!value || !Number.isFinite(Date.parse(value))) return "Não informado";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
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
    setCsvRows([]);
    setCsvInfo(null);
    setCsvAcknowledged(false);
    if (!file) return;
    try {
      const contents = await file.text();
      const prepared = prepareTechnicianCsv(contents, categories);
      setCsvRows(prepared);
      setCsvInfo(`${prepared.length} técnicos prontos para importar. Nenhum dado foi gravado ainda.`);
    } catch (error) {
      setCsvInfo(csvImportErrorText(error));
    }
  }

  async function submitCsvImport() {
    const auditReason = csvReason.trim();
    if (csvBusy || !registryAvailable || !csvRows.length || !csvAcknowledged ||
      auditReason.length < 8 || auditReason.length > 400 || publicTextProblem(auditReason, "identity")) return;
    if (!window.confirm(`Importar ${csvRows.length} técnicos como fichas administrativas editáveis? Contatos permanecerão privados e nenhuma conta será ativada.`)) return;
    setCsvBusy(true);
    let saved = 0;
    let failedAt = 0;
    for (const [index, row] of csvRows.entries()) {
      const payload = {
        display_name: row.displayName, city_ibge_id: row.cityIbgeId,
        ddd: row.ddd, region_approx: row.regionApprox,
        category_slugs: row.categorySlugs, service_slugs: [],
        admin_active: false, is_demo: false,
        phone_action: row.phoneE164 ? "replace" : "keep",
        ...(row.phoneE164 ? { phone_e164: row.phoneE164, contact_suspended: false } : {}),
      };
      const { data, error } = await db.rpc("eut_admin_technician_record_save", {
        _origin: "other_import", _source_id: row.sourceId,
        _expected_updated_at: null, _payload: payload, _reason: auditReason,
      });
      if (error || data?.ok !== true || !data.technician_id) {
        failedAt = index + 1;
        break;
      }
      saved += 1;
      if (saved % 5 === 0 || saved === csvRows.length)
        setCsvInfo(`Importação real em andamento: ${saved} de ${csvRows.length} confirmados pelo banco.`);
    }
    setCsvBusy(false);
    if (failedAt) {
      setCsvInfo(`${saved} fichas confirmadas. Falha na linha ${failedAt + 1}; revise seus dados e tente novamente com o mesmo arquivo.`);
    } else {
      setCsvRows([]);
      setCsvAcknowledged(false);
      setCsvInfo(`${saved} técnicos importados e auditados no banco; nenhum contato foi publicado.`);
    }
    if (saved) setReload((value) => value + 1);
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
    <h2 className="text-xl font-bold text-foreground">Gestão de técnicos</h2>
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
      <button type="button" aria-pressed={!recentOnly} onClick={() => { setRecentOnly(false); setSort("name-asc"); setPage(0); setSelectedKey(null); setImportKey(null); }}
        className={"min-h-11 rounded-lg border px-4 text-sm font-semibold " + (!recentOnly ? "bg-primary text-primary-foreground" : "border-input text-foreground")}>
        Todos os técnicos
      </button>
      <button type="button" aria-pressed={recentOnly} onClick={() => { setRecentOnly(true); setSort("newest"); setPage(0); setSelectedKey(null); setImportKey(null); }}
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
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold text-foreground"><span className="flex items-center gap-1"><SlidersHorizontal className="h-4 w-4" /> Situação</span>
          <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value as TechnicianStateFilter); setPage(0); }}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="all">Todas as situações</option>
            <option value="active">Ativos</option>
            <option value="inactive">Suspensos e arquivados</option>
            <option value="review">Sem ativação / em análise</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-foreground">Ordenar por
          <select value={sort} onChange={(event) => { setSort(event.target.value as TechnicianSortMode); setRecentOnly(false); setPage(0); }}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="name-asc">Nome A–Z</option>
            <option value="name-desc">Nome Z–A</option>
            <option value="newest">Cadastro mais recente (quando conhecido)</option>
            <option value="updated">Última atualização (quando conhecida)</option>
          </select>
        </label>
      </div>
      <div role="group" aria-label="Forma de exibição" className="flex items-center gap-1 rounded-xl border border-input bg-background p-1">
        {([{"value":"rows","label":"Linhas","icon":List},{"value":"cards","label":"Cartões","icon":Grid2X2},{"value":"avatars","label":"Avatares","icon":LayoutGrid}] as const)
          .map(({ value, label, icon: Icon }) => <button key={value} type="button" title={label}
            aria-label={`Exibir em ${label.toLowerCase()}`} aria-pressed={view === value} onClick={() => setView(value)}
            className={"flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold " + (view === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
            <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
          </button>)}
      </div>
    </div>
    {(region || specialty || stateFilter !== "all") && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Filtros ativos:</span>
      {region && <button type="button" onClick={() => filterRegion("")} className="min-h-9 rounded-full border border-input px-3">Região: {region} ×</button>}
      {specialty && <button type="button" onClick={() => filterSpecialty("")} className="min-h-9 rounded-full border border-input px-3">Especialidade: {specialty} ×</button>}
      {stateFilter !== "all" && <button type="button" onClick={() => { setStateFilter("all"); setPage(0); }} className="min-h-9 rounded-full border border-input px-3">Situação ×</button>}
    </div>}
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {loading || registryLoading ? "Consultando registros…" : failed ? "Consulta incompleta: verifique a permissão ou conexão." :
        `${total === null ? "Total em apuração" : (exactTotal ? "" : "cerca de ") + total.toLocaleString("pt-BR") + " técnicos"} · página ${page + 1} de ${pages} · ${UNIFIED_DIRECTORY_PAGE_SIZE} por página`}
    </p>
    {!loading && !registryLoading && !failed && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
          <input type="checkbox" checked={selectedAll} disabled={!selectableRows.length || bulkBusy}
            onChange={togglePageSelection} className="h-5 w-5 accent-primary" /> Selecionar página ({selectableRows.length})
        </label>
        <span role="status" className="text-sm text-muted-foreground">{selectedRows.length} selecionado(s)</span>
      </div>
      {selectedRows.length > 0 && <>
        <div role="group" aria-label="Ações em massa" className="mt-2 flex flex-wrap gap-2">
          {([{"value":"import","label":"Cadastrar selecionados"},{"value":"archive","label":"Arquivar / suspender"},{"value":"restore","label":"Restaurar / reativar"}] as const)
            .map((action) => <button type="button" key={action.value} disabled={bulkBusy}
              aria-pressed={bulkAction === action.value} onClick={() => { setBulkAction(action.value); setBulkReason(""); }}
              className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " + (bulkAction === action.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground")}>
              {action.label} ({selectedRows.filter((row) => canBulkAct(row, action.value)).length})
            </button>)}
          <button type="button" disabled={bulkBusy} onClick={() => { setSelected(new Set()); setBulkAction(null); }}
            className="min-h-11 rounded-lg border border-input px-3 text-sm">Limpar seleção</button>
        </div>
        {bulkAction && <form onSubmit={(event) => void runBulk(event)} className="mt-3 grid gap-2 rounded-lg border border-border bg-background p-3">
          <p className="text-sm text-foreground">{selectedRows.filter((row) => canBulkAct(row, bulkAction)).length} de {selectedRows.length} fichas permitem esta ação. As demais não serão modificadas.</p>
          <label className="grid gap-1 text-sm font-medium">Motivo administrativo (obrigatório para cada alteração)
            <textarea value={bulkReason} onChange={(event) => setBulkReason(event.target.value)}
              minLength={8} maxLength={400} required rows={2} className="min-w-0 rounded-lg border border-input bg-background p-3" />
          </label>
          <button type="submit" disabled={bulkBusy || bulkReason.trim().length < 8 || !selectedRows.some((row) => canBulkAct(row, bulkAction))}
            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {bulkBusy ? "Executando e conferindo respostas…" : "Confirmar ação em lote"}
          </button>
          <p className="text-xs text-muted-foreground">Somente esta página (até 18). Importações ficam sem contato e sem ativação automática; arquivamentos preservam histórico e podem ser restaurados.</p>
        </form>}
      </>}
    </div>}
    {feedback && <p role="status" className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">{feedback}</p>}
    {!loading && !registryLoading && !failed && <ul className={"mt-4 grid min-w-0 gap-3 " +
      (view === "rows" ? "grid-cols-1" : view === "cards" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
      {results.map((row) => <li key={row.key}
        className={"min-w-0 rounded-xl border bg-background p-3 transition-colors " +
          (selected.has(row.key) ? "border-primary/70 bg-primary/5" : "border-border") +
          (selectedKey === row.key ? " col-span-full" : "")}>
        <div className={"flex min-w-0 gap-3 " + (view === "avatars" && selectedKey !== row.key
          ? "flex-col items-center text-center" : view === "rows" || selectedKey === row.key
            ? "flex-col lg:flex-row lg:items-center" : "flex-col")}>
          <div className="flex items-center gap-3">
            <label className="flex min-h-11 min-w-8 shrink-0 cursor-pointer items-center justify-center"
              title={row.demo ? "Demonstração protegida" : `Selecionar ${row.name}`}>
              <input type="checkbox" aria-label={`Selecionar ${row.name}`} checked={selected.has(row.key)}
                disabled={Boolean(row.demo) || bulkBusy} onChange={() => toggleSelected(row.key)}
                className="h-5 w-5 accent-primary" />
            </label>
            <TechnicianAvatar name={row.name} avatarPath={row.avatarPath ?? null}
              className={view === "avatars" && selectedKey !== row.key ? "h-16 w-16 shrink-0" : "h-12 w-12 shrink-0"} />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block break-words leading-snug text-foreground">{row.name}</strong>
            <span className={"mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold " +
              (technicianState(row) === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                technicianState(row) === "inactive" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
              {technicianState(row) === "active" ? "Ativo" : technicianState(row) === "inactive" ? "Suspenso / arquivado" : "A revisar"}
            </span>
            {row.regionKey ? <button type="button" onClick={() => filterRegion(row.regionKey ?? "")}
              className="mt-1 block min-h-8 max-w-full break-words text-left text-xs text-primary underline-offset-2 hover:underline"
              title="Filtrar pela região">{row.location}</button>
              : <p className="mt-1 text-xs text-muted-foreground">{row.location}</p>}
            {row.specialty && <button type="button" onClick={() => filterSpecialty(categoryKeyword(row.specialty ?? ""))}
              className="mt-1 block min-h-8 max-w-full break-words text-left text-xs text-primary underline-offset-2 hover:underline"
              title="Filtrar pela categoria">{row.specialty}</button>}
            {row.demo && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Demonstração protegida</p>}
          </div>
          <div className={"flex shrink-0 flex-wrap items-center gap-2 " + (view === "avatars" ? "justify-center" : "sm:justify-end")}>
            <button type="button" onClick={() => setDetailKey((key) => key === row.key ? null : row.key)}
              aria-expanded={detailKey === row.key} className="min-h-10 rounded-lg border border-input px-3 text-xs font-semibold text-foreground hover:bg-muted">
              {detailKey === row.key ? "Fechar ficha" : "Ver ficha"}
            </button>
            {!row.demo && <button type="button" onClick={() => selectRow(row)} aria-expanded={selectedKey === row.key}
              className="min-h-10 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20">
              {selectedKey === row.key ? "Fechar edição" : "Editar"}
            </button>}
          </div>
        </div>
        {detailKey === row.key && <section aria-label={`Ficha de ${row.name}`}
          className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div><span className="block text-xs text-muted-foreground">Nome profissional</span><strong className="break-words">{row.name}</strong></div>
          <div><span className="block text-xs text-muted-foreground">Localidade</span><span className="break-words">{row.location}</span></div>
          <div><span className="block text-xs text-muted-foreground">Categoria / especialidade</span>{row.specialty || "Não informada"}</div>
          <div><span className="block text-xs text-muted-foreground">Situação</span>{technicianState(row) === "active" ? "Ativo" : technicianState(row) === "inactive" ? "Suspenso / arquivado" : "A revisar"}</div>
          <div><span className="block text-xs text-muted-foreground">Cadastro</span>{formatDate(row.createdAt)}</div>
          <div><span className="block text-xs text-muted-foreground">Última atualização</span>{formatDate(row.updatedAt)}</div>
          <div className="sm:col-span-2"><span className="block text-xs text-muted-foreground">Contato</span>
            {row.registry?.contact_last4 ? `Privado · final ${row.registry.contact_last4}` : "Privado / não informado"}
          </div>
        </section>}
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
            importedName={row.name} importedRegion={row.regionKey ?? ""} importedDemo={Boolean(row.demo)} available={registryAvailable}
            onCancel={() => { setImportKey(null); setSelectedKey(null); }}
            onSaved={(message) => { refreshAfterSaved(); setDraft(row.name); setFeedback(message); }} />}
        {selectedKey === row.key && importKey === row.key && !row.demo && !row.registry && row.origin === "guiafix" &&
          <AdminTechnicianRecordEditor key={row.key} sourceId={row.key} createOrigin="guiafix"
            importedName={row.name} importedRegion={row.regionKey ?? ""}
            importedCityIbgeId={row.cityIbgeId ?? null} available={registryAvailable}
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
      <button type="button" disabled={page === 0} onClick={() => { setPage((current) => Math.max(0, current - 1)); setSelectedKey(null); setImportKey(null); }}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-40">Anterior</button>
      <label className="flex items-center gap-2 text-sm text-foreground">Página
        <select aria-label="Ir para a página" value={page} onChange={(event) => { setPage(Number(event.target.value)); setSelectedKey(null); setImportKey(null); }}
          className="min-h-11 rounded-lg border border-input bg-background px-3">
          {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} de {pages}</option>)}
        </select>
      </label>
      <button type="button" disabled={page + 1 >= pages} onClick={() => { setPage((current) => Math.min(pages - 1, current + 1)); setSelectedKey(null); setImportKey(null); }}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-40">Próxima</button>
    </nav>}
    <p className="mt-4 text-xs text-muted-foreground">
      Edições e ações em massa exigem sessão administrativa autorizada e motivo auditável.
      O cadastro CSV é confirmado diretamente pela função auditada e não ativa contatos automaticamente.
    </p>
    <fieldset className="mt-4 space-y-2 rounded-xl border border-dashed border-border p-3">
      <legend className="text-sm font-semibold">Preparar importação CSV</legend>
      <p className="text-xs text-muted-foreground">
        Importe até 500 técnicos por arquivo de até 2 MB, com coluna nome obrigatória.
        Campos opcionais: ddd, cidade/regiao, ibge, categoria e telefone. Separe múltiplas categorias por |.
        A prévia fica neste aparelho; ao confirmar, as fichas são gravadas individualmente com auditoria,
        sem ativar conta nem contato público. Reenviar o mesmo arquivo não duplica técnicos.
      </p>
      <input type="file" accept=".csv,text/csv" aria-label="Selecionar CSV para análise local"
        className="max-w-full text-sm text-foreground"
        onChange={(event) => void inspectImport(event.target.files?.[0])} />
      {csvInfo && <p role="status" className="text-sm text-muted-foreground">{csvInfo}</p>}
      {csvRows.length > 0 && <div className="grid gap-3 rounded-lg border border-border p-3">
        <p className="text-sm font-semibold text-foreground">{csvRows.length} técnicos validados, aguardando confirmação.</p>
        <label className="grid gap-1 text-xs font-semibold text-foreground">
          Motivo administrativo para auditoria do lote
          <input value={csvReason} onChange={(event) => setCsvReason(event.target.value)}
            minLength={8} maxLength={400} placeholder="Ex.: importação autorizada do cadastro existente"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={csvAcknowledged}
            onChange={(event) => setCsvAcknowledged(event.target.checked)} />
          Confirmo que tenho autorização para cadastrar estes técnicos e tratar os contatos como privados.
        </label>
        <button type="button" disabled={csvBusy || !registryAvailable || !csvAcknowledged || csvReason.trim().length < 8}
          onClick={() => void submitCsvImport()}
          className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
          {csvBusy ? "Importando no banco…" : `Importar ${csvRows.length} técnicos agora`}
        </button>
      </div>}
    </fieldset>
  </section>;
}
