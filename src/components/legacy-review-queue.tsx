import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { LEGACY_REVIEW_PAGE_SIZE, normalizeLegacyReviewSearch } from "@/lib/legacy-review-utils";

type LegacyKind = "candidate" | "employer";
type LocalityFilter = "all" | "country_only" | "missing" | "city_unverified" | "demo_excluded" | "locality_unverified";

const localityLabels: Record<Exclude<LocalityFilter,"all"> | "not_applicable" | "not_evaluated",string> = {
  country_only: "Só o país — falta cidade",
  missing: "Localidade não informada",
  city_unverified: "Cidade indicada — confirmar",
  demo_excluded: "Demonstração — não publicar",
  locality_unverified: "Localidade a verificar",
  not_applicable: "Não aplicável",
  not_evaluated: "Ainda não avaliado",
};
type LegacyProfile = {
  source_key: string;
  wp_post_id: number;
  wp_user_id: number;
  kind: LegacyKind;
  slug: string;
  title: string;
  specialty_title: string | null;
  location1: string | null;
  location2: string | null;
  location3: string | null;
  review_status: "pending_review" | "in_review" | "excluded" | "verified";
  demo_candidate: boolean;
  locality_quality: Exclude<LocalityFilter,"all"> | "not_applicable" | "not_evaluated";
  specialty_present: boolean;
  wp_sector_tags: string[];
};

const FIELDS = "source_key,wp_post_id,wp_user_id,kind,slug,title,specialty_title,location1,location2,location3,review_status,demo_candidate,locality_quality,specialty_present,wp_sector_tags";

/**
 * The additional table is managed in external Supabase (not in Lovable-generated
 * types yet). This casts only the query builder, NEVER the authenticated client,
 * and RLS is enforced on every request by Supabase.
 */
const db = supabase as unknown as SupabaseClient;

export function LegacyReviewQueue() {
  const [kind, setKind] = useState<LegacyKind>("candidate");
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [localityFilter, setLocalityFilter] = useState<LocalityFilter>("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LegacyProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError(null);
      let query = db.from("legacy_review_profiles")
        .select(FIELDS, { count: "exact" })
        .eq("source_key", "wordpress_20261108")
        .eq("kind", kind);
      if (term) query = query.ilike("title", `%${term}%`);
      if (kind === "candidate" && localityFilter !== "all")
        query = query.eq("locality_quality", localityFilter);
      const { data, error: readError, count } = await query
        .order("wp_post_id", { ascending: true })
        .range(page * LEGACY_REVIEW_PAGE_SIZE, (page + 1) * LEGACY_REVIEW_PAGE_SIZE - 1);
      if (!current) return;
      if (readError) {
        setRows([]);
        setTotal(0);
        setError("Não foi possível consultar o inventário. Confirme seu acesso administrativo no Supabase.");
      } else {
        setRows((data ?? []) as LegacyProfile[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    }
    void load();
    return () => { current = false; };
  }, [kind, page, term, localityFilter]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setTerm(normalizeLegacyReviewSearch(draft));
    setPage(0);
  }

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5" aria-label="Cadastros históricos WordPress">
      <h2 className="text-lg font-semibold text-card-foreground">Cadastros históricos do WordPress</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Registros importados do portal original, disponíveis apenas para revisão administrativa.
        Não são contas Google ativas nem técnicos publicados. Nenhum telefone ou e-mail privado é exibido.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Tipo de cadastro histórico">
        <button type="button" onClick={() => { setKind("candidate"); setLocalityFilter("all"); setPage(0); }}
          aria-pressed={kind === "candidate"} className={`min-h-11 rounded-md border px-4 text-sm ${kind === "candidate" ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
          Técnicos
        </button>
        <button type="button" onClick={() => { setKind("employer"); setLocalityFilter("all"); setPage(0); }}
          aria-pressed={kind === "employer"} className={`min-h-11 rounded-md border px-4 text-sm ${kind === "employer" ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
          Contratantes
        </button>
      </div>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="legacy-review-search">Buscar nome histórico</label>
        <input id="legacy-review-search" value={draft} onChange={(event) => setDraft(event.target.value)}
          maxLength={100} placeholder="Buscar cadastro pelo nome"
          className="min-h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground" />
        <button type="submit" className="min-h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground">Buscar</button>
      </form>
      {kind === "candidate" && (
        <label className="mt-4 grid gap-1 text-sm text-foreground">
          Pendência da localização
          <select
            aria-label="Filtrar técnicos por situação da localidade"
            value={localityFilter}
            onChange={(event) => { setLocalityFilter(event.target.value as LocalityFilter); setPage(0); }}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">Todos os técnicos históricos</option>
            <option value="country_only">Só país — verificar cidade</option>
            <option value="missing">Sem localidade</option>
            <option value="city_unverified">Cidade indicada, não confirmada</option>
            <option value="demo_excluded">Demonstração (excluídos)</option>
            <option value="locality_unverified">Outras localidades a verificar</option>
          </select>
        </label>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        {loading ? "Consultando registros…" : `${total} registro(s) encontrado(s), página ${page + 1}.`}
      </p>
      {!loading && !error && rows.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum cadastro encontrado com esses filtros.</p>
      )}
      {!loading && rows.length > 0 && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={`${row.source_key}:${row.wp_post_id}`} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-card-foreground">{row.title}</strong>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Em revisão</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">WordPress #{row.wp_post_id} · usuário #{row.wp_user_id}</p>
              {row.specialty_title && (
                <p className="mt-2 text-sm text-card-foreground">
                  Título técnico original: {row.specialty_title}
                </p>
              )}
              {row.kind === "candidate" && row.wp_sector_tags?.length > 0 && (
                <p className="mt-2 text-sm text-card-foreground">
                  Categorias do WordPress: {row.wp_sector_tags.join(" · ")}
                </p>
              )}
              {row.kind === "candidate" && !row.specialty_present && !(row.wp_sector_tags?.length > 0) && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  Sem especialidade identificada: requer confirmação
                </p>
              )}
              {row.kind === "candidate" && (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  {localityLabels[row.locality_quality]}
                </p>
              )}
              {[row.location1, row.location2, row.location3].filter(Boolean).length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">{[row.location1, row.location2, row.location3].filter(Boolean).join(" · ")}</p>
              )}
              {row.demo_candidate && <p className="mt-2 text-xs font-medium text-destructive">Possível registro de demonstração: não publicar.</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-between gap-2">
        <button type="button" disabled={loading || page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground disabled:opacity-50">Anterior</button>
        <button type="button" disabled={loading || (page + 1) * LEGACY_REVIEW_PAGE_SIZE >= total}
          onClick={() => setPage((p) => p + 1)}
          className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground disabled:opacity-50">Próximo</button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A cidade nunca é deduzida do país Brasil. As categorias foram recuperadas da taxonomia histórica e ainda precisam de confirmação. Para ativar um cadastro é necessário verificar a identidade Google do titular e concluir a aprovação.
        Esta tela é somente de consulta — não concede acesso nem publica perfis.
      </p>
    </section>
  );
}
