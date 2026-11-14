import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";
import {
  categoryKeyword, UNIFIED_DIRECTORY_PAGE_SIZE, unifiedPageCount, unifiedPageSlice,
} from "@/lib/admin-unified-pagination";

// Three sources, one administrative directory. Historical identities are never
// silently promoted to operational accounts or given a telephone here.
const captures = import.meta.glob("../../data/external-staging/guiafix-*.capture.json", {
  eager: true, import: "default",
}) as Record<string, unknown>;
const guiafix = readGuiafixStaging(Object.values(captures));
const db = supabase as unknown as SupabaseClient;
const FETCH_CHUNK = 200;
type TechnicianStatus = Tables<"technicians">["status"];

export type AdminTechnicianDirectoryFocus = {
  id: string;
  name: string;
  status: TechnicianStatus;
};
export type AdminLegacyDirectoryFocus = { wpPostId: number; name: string };

type DirectoryRow = {
  key: string;
  name: string;
  location: string;
  regionKey: string | null;
  specialty: string | null;
  origin: "portal" | "wordpress" | "guiafix";
  status?: TechnicianStatus;
  technicianId?: string;
  wpPostId?: number;
  createdAt?: string;
  demo?: boolean;
};

// PostgREST `or` has its own syntax; never interpolate punctuation/operators.
export function cleanUnifiedSearch(value: string): string {
  return value.trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ").slice(0, 80).trim();
}

const locationIsSpecific = (value: string): boolean =>
  Boolean(value) && !/^(brasil|brazil|desconhecid[ao]|n[aã]o informad[ao])$/i.test(value.trim());

export function AdminTechnicianUnifiedDirectory({
  onEditTechnician, onReviewLegacy,
}: {
  onEditTechnician?: (focus: AdminTechnicianDirectoryFocus) => void;
  onReviewLegacy?: (focus: AdminLegacyDirectoryFocus) => void;
}) {
  const [draft, setDraft] = useState("");
  const [regionDraft, setRegionDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [term, setTerm] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [legacy, setLegacy] = useState<DirectoryRow[]>([]);
  const [operational, setOperational] = useState<DirectoryRow[]>([]);
  const [legacyTotal, setLegacyTotal] = useState(0);
  const [operationalTotal, setOperationalTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { categories } = useActiveCategories();
  const categoryTerm = categoryKeyword(category);
  const matchedSlugs = useMemo(() => categoryTerm
    ? categories.filter((item) => normalizeGuiafixSearch(`${item.slug} ${item.label}`)
      .includes(categoryTerm)).map((item) => item.slug)
    : [], [categories, categoryTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(cleanUnifiedSearch(draft));
      setRegion(cleanUnifiedSearch(regionDraft));
      setCategory(cleanUnifiedSearch(categoryDraft));
      setPage(0);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [draft, regionDraft, categoryDraft]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    // Fetch only a bounded prefix per source. The global alphabetical page is
    // then selected from the merged prefix; no "load more" grows the DOM.
    const needed = (page + 1) * UNIFIED_DIRECTORY_PAGE_SIZE;
    async function loadOperational() {
      if (categoryTerm && matchedSlugs.length === 0) return { rows: [] as DirectoryRow[], total: 0 };
      const rows: DirectoryRow[] = [];
      let total = 0;
      for (let start = 0; start < needed && active; start += FETCH_CHUNK) {
        let query = db.from("technicians")
          .select("id,display_name,city,state_uf,region,specialties,status,created_at", { count: "exact" });
        if (term) query = query.ilike("display_name", `%${term}%`);
        if (region) query = region.length === 2
          ? query.eq("state_uf", region.toUpperCase())
          : query.or(["city", "region"].map((field) => `${field}.ilike.%${region}%`).join(","));
        if (categoryTerm) query = query.overlaps("specialties", matchedSlugs);
        const response = await query
          .order(recentOnly ? "created_at" : "display_name", { ascending: !recentOnly })
          .order("id", { ascending: true })
          .range(start, Math.min(start + FETCH_CHUNK, needed) - 1);
        if (response.error) throw new Error("operational source unavailable");
        total = response.count ?? 0;
        rows.push(...(response.data ?? []).map((item): DirectoryRow => ({
          key: `portal:${item.id}`, name: item.display_name || "Técnico sem nome de exibição",
          location: [item.city, item.state_uf].filter(Boolean).join("/") || item.region || "Localidade não informada",
          regionKey: locationIsSpecific(item.city ?? "") ? item.city : item.state_uf || null,
          specialty: item.specialties?.join(", ") || null,
          origin: "portal", status: item.status as TechnicianStatus,
          technicianId: item.id, createdAt: item.created_at,
        })));
        if (!response.data?.length || rows.length >= total) break;
      }
      return { rows, total };
    }
    async function loadWordpress() {
      if (recentOnly) return { rows: [] as DirectoryRow[], total: 0 };
      const rows: DirectoryRow[] = [];
      let total = 0;
      for (let start = 0; start < needed && active; start += FETCH_CHUNK) {
        let query = db.from("legacy_review_profiles")
          .select("source_key,wp_post_id,kind,title,specialty_title,location1,location2,location3,demo_candidate", { count: "exact" })
          .eq("source_key", "wordpress_20261108").eq("kind", "candidate");
        if (term) query = query.or(["title", "location1", "location2", "location3"]
          .map((field) => `${field}.ilike.%${term}%`).join(","));
        if (region) query = query.or(["location1", "location2", "location3"]
          .map((field) => `${field}.ilike.%${region}%`).join(","));
        if (categoryTerm) query = query.ilike("specialty_title", `%${categoryTerm}%`);
        const response = await query.order("title").order("wp_post_id")
          .range(start, Math.min(start + FETCH_CHUNK, needed) - 1);
        if (response.error) throw new Error("WordPress inventory unavailable");
        total = response.count ?? 0;
        rows.push(...(response.data ?? []).map((item): DirectoryRow => {
          const locations = [item.location1, item.location2, item.location3].filter(Boolean) as string[];
          return {
            key: `wp:${item.kind}:${item.wp_post_id}`,
            name: item.title || "Técnico sem nome recuperado",
            location: locations.join(" · ") || "Localidade não confirmada",
            regionKey: locations.find(locationIsSpecific)?.split("/")[0]?.trim() ?? null,
            specialty: item.specialty_title || null,
            origin: "wordpress", wpPostId: item.wp_post_id, demo: item.demo_candidate,
          };
        }));
        if (!response.data?.length || rows.length >= total) break;
      }
      return { rows, total };
    }
    void Promise.all([loadOperational(), loadWordpress()]).then(([portal, wp]) => {
      if (!active) return;
      setOperational(portal.rows);
      setOperationalTotal(portal.total);
      setLegacy(wp.rows);
      setLegacyTotal(wp.total);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setFailed(true);
        setOperational([]);
        setLegacy([]);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [term, region, categoryTerm, matchedSlugs, page, recentOnly]);

  const guiafixResults = useMemo(() => recentOnly ? [] : guiafix.filter((row) =>
    (!term || normalizeGuiafixSearch(`${row.name} ${row.city} ${row.uf}`)
      .includes(normalizeGuiafixSearch(term))) &&
    (!region || normalizeGuiafixSearch(`${row.city} ${row.uf}`)
      .includes(normalizeGuiafixSearch(region))) &&
    (!categoryTerm || normalizeGuiafixSearch(row.category).includes(categoryTerm))
  ).map((row): DirectoryRow => ({
    key: `guiafix:${row.key}`, name: row.name,
    location: `${row.city}/${row.uf} (local da fonte)`, regionKey: row.city,
    specialty: row.category, origin: "guiafix",
  })), [term, region, categoryTerm, recentOnly]);

  const total = operationalTotal + legacyTotal + guiafixResults.length;
  const pages = unifiedPageCount(total);
  const results = useMemo(() => unifiedPageSlice(
    [...operational, ...legacy, ...guiafixResults].sort((a, b) =>
      recentOnly
        ? (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0)
        : a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key)),
    page,
  ), [operational, legacy, guiafixResults, page, recentOnly]);

  function applyRegion(value: string) {
    setRegionDraft(value); setRegion(cleanUnifiedSearch(value)); setPage(0);
  }
  function applyCategory(value: string) {
    setCategoryDraft(value); setCategory(cleanUnifiedSearch(value)); setPage(0);
  }

  return <section id="admin-unified-directory" className="mt-6 scroll-mt-24 rounded-2xl border border-primary/20 bg-card p-4 sm:p-6" aria-label="Busca unificada de técnicos">
    <h2 className="text-xl font-bold text-foreground">Técnicos — diretório administrativo</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Uma única lista paginada de técnicos, independentemente da origem. A procedência serve apenas
      para auditoria: um nome histórico não vira conta ativa sem vínculo comprovado.
    </p>
    <div role="group" aria-label="Visualização de técnicos" className="mt-4 flex flex-wrap gap-2">
      <button type="button" aria-pressed={!recentOnly} onClick={() => { setRecentOnly(false); setPage(0); }}
        className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${!recentOnly ? "bg-primary text-primary-foreground" : "border-input text-foreground"}`}>Todos os técnicos</button>
      <button type="button" aria-pressed={recentOnly} onClick={() => { setRecentOnly(true); setPage(0); }}
        className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${recentOnly ? "bg-primary text-primary-foreground" : "border-input text-foreground"}`}>Últimos cadastros do portal</button>
      <Link to="/admin/$secao" params={{ secao: "catalogo" }} className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 text-sm font-semibold text-primary">Gerenciar categorias e serviços</Link>
    </div>
    {recentOnly && <p className="mt-2 text-xs text-muted-foreground">A ordem de cadastro só é comprovável para contas do portal; arquivos WordPress/Guiafix não recebem datas inventadas.</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-1 text-sm font-semibold text-foreground">Nome
        <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={80}
          placeholder="Pesquisar nome" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Cidade, região ou UF
        <input value={regionDraft} onChange={(event) => setRegionDraft(event.target.value)} maxLength={80}
          placeholder="Ex.: Curitiba ou PR" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-foreground">Categoria ou especialidade
        <input value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} maxLength={80}
          placeholder="Ex.: informática" className="min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal text-foreground" />
      </label>
    </div>
    {(region || category) && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Filtros:</span>
      {region && <button type="button" onClick={() => applyRegion("")} className="min-h-9 rounded-full border border-input px-3">Região: {region} ×</button>}
      {category && <button type="button" onClick={() => applyCategory("")} className="min-h-9 rounded-full border border-input px-3">Especialidade: {category} ×</button>}
    </div>}
    <p role="status" className="mt-4 text-sm text-muted-foreground">
      {loading ? "Consultando fontes…" : failed ? "Consulta incompleta: confira a permissão ou conexão." :
        `${total.toLocaleString("pt-BR")} ficha(s) · página ${page + 1} de ${pages} · até ${UNIFIED_DIRECTORY_PAGE_SIZE} por página`}
    </p>
    {!loading && !failed && <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {results.map((row) => <li key={row.key} className="min-w-0 rounded-xl border border-border bg-background p-4">
        <strong className="break-words text-foreground">{row.name}</strong>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.regionKey ? <button type="button" title="Ver outros técnicos nesta região"
            onClick={() => applyRegion(row.regionKey ?? "")}
            className="min-h-9 rounded-lg border border-input px-2 text-left text-xs font-medium text-primary">{row.location}</button>
            : <p className="text-xs text-muted-foreground">{row.location}</p>}
          {row.specialty && <button type="button" title="Filtrar esta especialidade"
            onClick={() => applyCategory(categoryKeyword(row.specialty ?? ""))}
            className="min-h-9 rounded-lg border border-input px-2 text-left text-xs font-medium text-primary">{row.specialty}</button>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {row.origin === "portal" ? `Cadastro do portal · ${row.status ?? "estado a confirmar"}` : row.origin === "wordpress" ? "Ficha histórica WordPress" : "Referência Guiafix"}
          {row.demo ? " · demonstração protegida" : ""}
        </p>
        {row.technicianId && row.status && onEditTechnician && <button type="button"
          className="mt-3 min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground sm:w-auto"
          onClick={() => onEditTechnician({ id: row.technicianId!, name: row.name, status: row.status! })}>
          Editar cadastro
        </button>}
        {row.wpPostId !== undefined && onReviewLegacy && <button type="button"
          className="mt-3 min-h-11 w-full rounded-lg border border-input px-4 text-sm font-semibold text-foreground sm:w-auto"
          onClick={() => onReviewLegacy({ wpPostId: row.wpPostId!, name: row.name })}>
          Revisar ficha histórica
        </button>}
        {row.origin === "guiafix" && <p className="mt-3 text-xs text-muted-foreground">Edição operacional indisponível até conciliação verificável com uma conta do portal.</p>}
      </li>)}
    </ul>}
    {!loading && !failed && results.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nenhum técnico corresponde aos filtros.</p>}
    {!loading && !failed && total > 0 && <nav aria-label="Paginação do diretório unificado" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-40">Anterior</button>
      <label className="flex items-center gap-2 text-sm text-foreground">Página
        <select aria-label="Ir para a página" value={page} onChange={(event) => setPage(Number(event.target.value))}
          className="min-h-11 rounded-lg border border-input bg-background px-3">
          {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} de {pages}</option>)}
        </select>
      </label>
      <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
        className="min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-40">Próxima</button>
    </nav>}
    <p className="mt-4 text-xs text-muted-foreground">Edição completa exige vínculo operacional. Para WordPress, o painel permite correção e auditoria da ficha sem alterar a origem; Guiafix continua somente referência até conciliação.</p>
  </section>;
}
