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
  portalUpdatedAt?: string;
  avatarPath?: string | null;
  cityIbgeId?: number;
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
type ViewMode = "linhas" | "cartoes" | "avatares";
type SortMode = "nome" | "localidade" | "especialidade" | "cadastro";

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
  const [viewMode, setViewMode] = useState<ViewMode>("linhas");
  const [sortMode, setSortMode] = useState<SortMode>("nome");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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
      setSelectedKeys([]);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [draft, regionDraft, specialtyDraft]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setFailed(false);
    async function load() {
      // Query each source in bounded chunks until its count is satisfied.
      // Cross-source sorting and arbitrary page jumps require the complete
      // filtered set; partial per-source prefixes gave misleading page order.
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
        for (let start = 0; current; start += FETCH_CHUNK) {
          let query = db.from("technicians")
            .select("id,display_name,city,state_uf,region,specialties,status,created_at,updated_at,avatar_path", { count: "exact" });
          if (term) query = query.ilike("display_name", `%${term}%`);
          if (region) query = region.length === 2 ? query.eq("state_uf", region.toUpperCase())
            : query.or(["city", "region"].map((field) => `${field}.ilike.%${region}%`).join(","));
          if (specialtyTerm) query = query.overlaps("specialties", matchedSlugs);
          const result = await query.order("display_name").order("id").range(start, start + FETCH_CHUNK - 1);
          if (result.error) throw new Error("portal directory unavailable");
          total = result.count ?? 0;
          rows.push(...(result.data ?? []).map((item): DirectoryRow => ({
            key: `portal:${item.id}`, portalId: item.id, portalUpdatedAt: item.updated_at, avatarPath: item.avatar_path,
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
        for (let start = 0; current; start += FETCH_CHUNK) {
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
            .range(start, start + FETCH_CHUNK - 1);
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
  }, [term, region, specialtyTerm, matchedSlugs, recentOnly, reload]);

  useEffect(() => {
    let current = true;
    setRegistryLoading(true);
    async function loadRegistry() {
      const fetched: AdminTechnicianRegistryRecord[] = [];
      // The registry RPC has a strict 100-row maximum per call.
      // With locality/specialty filters, read all matching-by-name records so
      // the client does not silently omit later matching category/region rows.
      let total = 0;
      for (let offset = 0; current; offset += 100) {
        const { data, error } = await db.rpc("eut_admin_technician_registry_list", {
          _search: term, _limit: 100, _offset: offset,
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
  }, [term, region, specialtyTerm, reload]);

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
    setSelectedKeys([]);
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
      demo: item.is_demo,
    }));
    const legacyUnlinked = legacy.filter((item) => !importedWp.has(`wordpress_20261108:${item.wpPostId}`));
    const guiafixUnlinked = guiafixResults.filter((item) => !importedGuiafix.has(item.key));
    const rows = [...operational,
      ...legacyUnlinked,
      ...guiafixUnlinked,
      ...registryRows];
    const compare = (a: string, b: string) => a.localeCompare(b, "pt-BR");
    rows.sort((a, b) => {
      if (recentOnly || sortMode === "cadastro")
        return (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0)
          || compare(a.name, b.name) || compare(a.key, b.key);
      if (sortMode === "localidade")
        return compare(a.regionKey ?? "zzzz", b.regionKey ?? "zzzz") || compare(a.name, b.name);
      if (sortMode === "especialidade")
        return compare(a.specialty ?? "zzzz", b.specialty ?? "zzzz") || compare(a.name, b.name);
      return compare(a.name, b.name) || compare(a.key, b.key);
    });
    return { rows, importedCount: legacy.length - legacyUnlinked.length + guiafixResults.length - guiafixUnlinked.length,
      registryFilteredCount: registryRows.length };
  }, [operational, legacy, guiafixResults, registry, municipalityNames, region, specialtyTerm, recentOnly, sortMode]);
  const results = useMemo(() => unifiedPageSlice(merged.rows, page), [merged, page]);
  const registryCount = recentOnly ? 0 : region || specialtyTerm ? merged.registryFilteredCount : registryAvailable ? registryTotal : 0;
  const total = operationalTotal === null || legacyTotal === null ? null
    : Math.max(0, operationalTotal + legacyTotal + guiafixResults.length + registryCount - (recentOnly ? 0 : merged.importedCount));
  const exactTotal = operationalTotal !== null && legacyTotal !== null &&
    operational.length >= operationalTotal && legacy.length >= legacyTotal &&
    (!registryAvailable || registry.length >= registryTotal);
  const pages = unifiedPageCount(total ?? 0);
  const selectablePage = results.filter((row) => !row.demo);
  const selectedRows = merged.rows.filter((row) => selectedKeys.includes(row.key) && !row.demo);

  function filterRegion(value: string) {
    setRegionDraft(value); setRegion(cleanUnifiedSearch(value)); setPage(0); setSelectedKey(null); setImportKey(null); setSelectedKeys([]);
  }
  function filterSpecialty(value: string) {
    setSpecialtyDraft(value); setSpecialty(cleanUnifiedSearch(value)); setPage(0); setSelectedKey(null); setImportKey(null); setSelectedKeys([]);
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
      // Keep the exact same file keys: retrying cannot overwrite prior imports.
      setCsvInfo(`${saved} fichas confirmadas. Falha na linha ${failedAt + 1}; revise seus dados e tente novamente com o mesmo arquivo.`);
    } else {
      setCsvRows([]);
      setCsvAcknowledged(false);
      setCsvInfo(`${saved} técnicos importados e auditados no banco; nenhum contato foi publicado.`);
    }
    if (saved) setReload((value) => value + 1);
  }

  function toggleSelected(key: string, checked: boolean) {
    setSelectedKeys((before) => checked
      ? before.includes(key) ? before : before.length < 50 ? [...before, key] : before
      : before.filter((value) => value !== key));
  }

  async function executeBulk(action: "importar" | "arquivar") {
    const auditReason = bulkReason.trim();
    if (bulkBusy || !registryAvailable || !selectedRows.length ||
      auditReason.length < 8 || auditReason.length > 400 || publicTextProblem(auditReason, "identity")) {
      setFeedback("Selecione técnicos e informe uma justificativa administrativa de 8 a 400 caracteres.");
      return;
    }
    const candidates = selectedRows.filter((row) => action === "importar"
      ? !row.registry && (row.origin === "wordpress" || row.origin === "guiafix")
      : Boolean(row.registry && !row.registry.archived) ||
        Boolean(row.wpPostId !== undefined && row.recordState !== "excluido") ||
        Boolean(row.portalId && row.portalUpdatedAt));
    if (!candidates.length) {
      setFeedback("Nenhum dos selecionados permite esta operação. Abra o técnico para editar individualmente.");
      return;
    }
    const label = action === "importar" ? "Importar" : "Arquivar";
    if (!window.confirm(`${label} ${candidates.length} técnicos com registro de auditoria? Operações não eliminam dados nem liberam contatos.`)) return;
    setBulkBusy(true);
    setFeedback(null);
    let done = 0;
    for (const row of candidates) {
      let data: { ok?: boolean; updated?: number } | null = null;
      let error: unknown = null;
      if (action === "importar") {
        const sourceId = row.origin === "wordpress"
          ? `wordpress_20261108:${row.wpPostId}` : row.key;
        ({ data, error } = await db.rpc("eut_admin_technician_record_save", {
          _origin: row.origin, _source_id: sourceId,
          _expected_updated_at: null, _reason: auditReason,
          _payload: { display_name: row.name, city_ibge_id: row.cityIbgeId ?? null, ddd: null,
            region_approx: row.regionKey || null, category_slugs: [], service_slugs: [],
            admin_active: false, is_demo: false, phone_action: "keep" },
        }));
      } else if (row.registry) {
        ({ data, error } = await db.rpc("eut_admin_technician_record_archive", {
          _technician_id: row.registry.technician_id,
          _expected_updated_at: row.registry.updated_at,
          _action: "archive", _reason: auditReason,
        }));
      } else if (row.wpPostId !== undefined) {
        ({ data, error } = await db.rpc("eut_admin_legacy_action", {
          p_ids: [row.wpPostId], p_action: "arquivar",
          p_value: "", p_reason: auditReason,
        }));
      } else if (row.portalId && row.portalUpdatedAt) {
        ({ data, error } = await db.rpc("eut_admin_technician_archive", {
          _technician_id: row.portalId, _expected_updated_at: row.portalUpdatedAt,
          _action: "archive", _reason: auditReason,
        }));
      }
      if (error || (!data?.ok && data?.updated !== 1)) break;
      done += 1;
    }
    setBulkBusy(false);
    setSelectedKeys([]);
    setFeedback(`${done} de ${candidates.length} técnicos ${action === "importar" ? "importados" : "arquivados"} com confirmação no banco.` +
      (done < candidates.length ? " A operação foi interrompida na primeira falha; revise a ficha antes de repetir." : ""));
    if (done) setReload((value) => value + 1);
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
      <button type="button" aria-pressed={!recentOnly} onClick={() => { setRecentOnly(false); setPage(0); setSelectedKey(null); setImportKey(null); setSelectedKeys([]); }}
        className={"min-h-11 rounded-lg border px-4 text-sm font-semibold " + (!recentOnly ? "bg-primary text-primary-foreground" : "border-input text-foreground")}>
        Todos os técnicos
      </button>
      <button type="button" aria-pressed={recentOnly} onClick={() => { setRecentOnly(true); setPage(0); setSelectedKey(null); setImportKey(null); setSelectedKeys([]); }}
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
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-background p-3">
      <label className="grid min-w-[170px] gap-1 text-xs font-semibold text-foreground">
        Ordenar listagem
        <select value={recentOnly ? "cadastro" : sortMode}
          onChange={(event) => { setSortMode(event.target.value as SortMode); setRecentOnly(false); setPage(0); setSelectedKey(null); setSelectedKeys([]); }}
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-sm text-foreground">
          <option value="nome">Nome (A–Z)</option>
          <option value="cadastro">Cadastro mais recente</option>
          <option value="localidade">Cidade / região</option>
          <option value="especialidade">Categoria / especialidade</option>
        </select>
      </label>
      <div role="group" aria-label="Modo de visualização dos técnicos" className="flex flex-wrap gap-1">
        {(["linhas", "cartoes", "avatares"] as const).map((mode) =>
          <button key={mode} type="button" aria-pressed={viewMode === mode}
            onClick={() => { setViewMode(mode); setSelectedKey(null); }}
            className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " +
              (viewMode === mode ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground")}>
            {mode === "linhas" ? "Linhas" : mode === "cartoes" ? "Detalhado" : "Avatares"}
          </button>)}
      </div>
    </div>
    {(region || specialty) && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Filtros ativos:</span>
      {region && <button type="button" onClick={() => filterRegion("")} className="min-h-9 rounded-full border border-input px-3">Região: {region} ×</button>}
      {specialty && <button type="button" onClick={() => filterSpecialty("")} className="min-h-9 rounded-full border border-input px-3">Especialidade: {specialty} ×</button>}
    </div>}
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {loading || registryLoading ? "Consultando registros…" : failed ? "Consulta incompleta: verifique a permissão ou conexão." :
        `${total === null ? "Total indisponível" : (exactTotal ? "" : "cerca de ") + total.toLocaleString("pt-BR") + " técnicos"} · página ${page + 1} de ${pages} · até ${UNIFIED_DIRECTORY_PAGE_SIZE} por página`}
    </p>
    {feedback && <p role="status" className="mt-3 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">{feedback}</p>}
    {!loading && !registryLoading && !failed && results.length > 0 && <div className="mt-3 rounded-xl border border-border p-3">
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-foreground">
        <input type="checkbox" aria-label="Selecionar técnicos desta página"
          checked={selectablePage.length > 0 && selectablePage.every((row) => selectedKeys.includes(row.key))}
          onChange={(event) => setSelectedKeys((before) => event.target.checked
            ? [...new Set([...before, ...selectablePage.map((row) => row.key)])].slice(0, 50)
            : before.filter((key) => !selectablePage.some((row) => row.key === key)))} />
        Selecionar página · {selectedRows.length} selecionados (máximo 50)
      </label>
      {selectedRows.length > 0 && <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="grid gap-1 text-xs font-semibold text-foreground">Justificativa para ação em massa
          <input value={bulkReason} onChange={(event) => setBulkReason(event.target.value)}
            minLength={8} maxLength={400} placeholder="Motivo administrativo (mínimo 8 caracteres)"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal" />
        </label>
        <button type="button" disabled={bulkBusy || !registryAvailable}
          onClick={() => void executeBulk("importar")}
          className="min-h-11 rounded-lg border border-primary/40 px-3 text-sm font-semibold text-primary disabled:opacity-50">
          {bulkBusy ? "Aguarde…" : "Importar selecionados"}
        </button>
        <button type="button" disabled={bulkBusy || !registryAvailable}
          onClick={() => void executeBulk("arquivar")}
          className="min-h-11 rounded-lg border border-amber-500/50 px-3 text-sm font-semibold text-foreground disabled:opacity-50">
          {bulkBusy ? "Aguarde…" : "Arquivar selecionados"}
        </button>
      </div>}
    </div>}
    {!loading && !registryLoading && !failed && <ul className={"mt-4 grid min-w-0 " +
      (viewMode === "avatares" ? "grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" :
        viewMode === "cartoes" ? "gap-3 sm:grid-cols-2" : "gap-1 lg:grid-cols-2")}>
      {results.map((row) => <li key={row.key} className={"min-w-0 rounded-xl border border-border bg-background " +
        (selectedKey === row.key ? "col-span-full " : "") +
        (viewMode === "linhas" ? "px-3 py-2" : "p-3 sm:p-4")}>
        <div className={"flex min-w-0 justify-between gap-2 " +
          (viewMode === "avatares" ? "flex-col items-center text-center" :
            viewMode === "cartoes" ? "flex-col sm:flex-row sm:items-start" : "items-start")}>
          <div className={"flex min-w-0 gap-2 " +
            (viewMode === "avatares" ? "flex-col items-center" : "items-start")}>
            <label className="flex shrink-0 items-center" title="Selecionar para ação em massa">
              <input type="checkbox" aria-label={`Selecionar ${row.name}`}
                checked={selectedKeys.includes(row.key)} disabled={Boolean(row.demo)}
                onChange={(event) => toggleSelected(row.key, event.target.checked)} />
            </label>
            {viewMode === "avatares" && <TechnicianAvatar name={row.name} avatarPath={row.avatarPath}
              className="h-16 w-16" />}
            <div className="min-w-0">
            <strong className="break-words text-foreground">{row.name}</strong>
            {row.regionKey ? <button type="button" onClick={() => filterRegion(row.regionKey ?? "")}
              className="mt-1 min-h-9 break-words text-left text-sm text-primary underline-offset-2 hover:underline"
              title="Encontrar outros técnicos nesta região">{row.location}</button>
              : <p className="mt-1 text-sm text-muted-foreground">{row.location}</p>}
            {row.specialty && viewMode !== "avatares" && <button type="button" onClick={() => filterSpecialty(categoryKeyword(row.specialty ?? ""))}
              className="mt-1 min-h-9 break-words text-left text-xs text-primary underline-offset-2 hover:underline"
              title="Encontrar especialidades semelhantes">{row.specialty}</button>}
            {row.demo && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Demonstração protegida: indisponível para ativação.</p>}
            </div>
          </div>
          <div className={"flex shrink-0 flex-wrap gap-2 " + (viewMode === "avatares" ? "w-full" : "")}>
            {!row.demo &&
              <button type="button" onClick={() => selectRow(row)} aria-expanded={selectedKey === row.key}
                className="min-h-10 w-full shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20 sm:w-auto">
                {selectedKey === row.key ? "Fechar" : "Abrir / editar"}
              </button>}
          </div>
        </div>
        {row.registry && viewMode === "cartoes" && <p className="mt-2 text-xs text-muted-foreground">
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
      Toda edição é confirmada e auditada no banco. Contatos privados, demonstrações protegidas e restrições
      permanecem preservados. Técnico histórico pode ser editado diretamente após salvar sua ficha administrativa.
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
