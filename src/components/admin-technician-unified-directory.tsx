import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";

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
  name: string;
  location: string;
  specialty: string | null;
  origin: "portal" | "wordpress" | "guiafix";
  operational: boolean;
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

export function AdminTechnicianUnifiedDirectory() {
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(cleanUnifiedSearch(draft));
      setOperationalPage(0);
      setLegacyPage(0);
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
        .eq("source_key", "wordpress_20261108");
      if (term) {
        techQuery = techQuery.ilike("display_name", `%${term}%`);
        wpQuery = wpQuery.or(["title", "location1", "location2", "location3"]
          .map((field) => `${field}.ilike.%${term}%`).join(","));
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
      const operationalRows: DirectoryRow[] = (tech.data ?? []).map((item) => ({
        key: `portal:${item.id}`, name: item.display_name || "Técnico sem nome de exibição",
        location: [item.city, item.state_uf].filter(Boolean).join("/") || item.region || "Localidade não informada",
        specialty: item.specialties?.join(", ") || null,
        origin: "portal", operational: item.status === "aprovado",
      }));
      const wpRows: DirectoryRow[] = (wp.data ?? []).map((item) => ({
        key: `wp:${item.kind}:${item.wp_post_id}`,
        name: item.title || "Técnico sem nome recuperado",
        location: [item.location1, item.location2, item.location3].filter(Boolean).join(" · ") || "Localidade não confirmada",
        specialty: item.specialty_title || null,
        origin: "wordpress", operational: false, demo: item.demo_candidate,
      }));
      setOperational((prev) => operationalPage === 0 ? operationalRows : appendUnique(prev, operationalRows));
      setOperationalTotal(tech.count);
      setLegacy((prev) => legacyPage === 0 ? wpRows : appendUnique(prev, wpRows));
      setLegacyTotal(wp.count);
      setLoading(false);
    }
    void load().catch(() => { if (current) { setFailed(true); setLoading(false); } });
    return () => { current = false; };
  }, [term, operationalPage, legacyPage]);

  const guiafixResults = useMemo(() => guiafix.filter((row) =>
    !term || normalizeGuiafixSearch(`${row.name} ${row.city} ${row.uf}`)
      .includes(normalizeGuiafixSearch(term))
  ).map((row): DirectoryRow => ({
    key: `guiafix:${row.key}`, name: row.name, location: `${row.city}/${row.uf} (local da fonte)`,
    specialty: row.category, origin: "guiafix", operational: false,
  })), [term]);
  const results = useMemo(() => [...operational, ...legacy, ...guiafixResults]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key)),
  [operational, legacy, guiafixResults]);
  const total = operationalTotal === null || legacyTotal === null ? null
    : operationalTotal + legacyTotal + guiafixResults.length;
  const moreLegacy = legacyTotal !== null && legacy.length < legacyTotal;
  const moreOperational = operationalTotal !== null && operational.length < operationalTotal;

  return <section className="mt-6 rounded-2xl border border-primary/20 bg-card p-4 sm:p-6" aria-label="Busca unificada de técnicos">
    <h2 className="text-xl font-bold text-foreground">Todos os técnicos — pesquisa administrativa</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Um único campo de busca para registros do portal, WordPress e Guiafix. As origens ficam registradas
      para auditoria, sem separar os profissionais em categorias de pessoa. Esta lista não concede
      automaticamente login, contato comercial ou área de atendimento aos arquivos importados.
    </p>
    <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="admin-unified-technician-search">Buscar por nome ou localidade da fonte</label>
    <input id="admin-unified-technician-search" value={draft} onChange={(event) => setDraft(event.target.value)}
      maxLength={80} placeholder="Digite o nome, cidade ou UF" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-foreground" />
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {loading ? "Consultando fontes…" : failed ? "Consulta incompleta: verifique a permissão ou conexão." :
        `${total === null ? "Total indisponível" : total.toLocaleString("pt-BR") + " fichas encontradas"} · ${results.length} exibidas`}
    </p>
    {!failed && <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {results.map((row) => <li key={row.key} className="rounded-xl border border-border bg-background p-4">
        <strong className="break-words text-foreground">{row.name}</strong>
        <p className="mt-1 text-sm text-muted-foreground">{row.location}</p>
        {row.specialty && <p className="mt-1 text-xs text-muted-foreground">{row.specialty}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {row.origin === "portal" ? "Cadastro do portal" : row.origin === "wordpress" ? "Origem WordPress" : "Origem Guiafix"}
          {row.demo ? " · Exemplo de demonstração protegido" : ""}
        </p>
        <span className="mt-2 block text-xs font-medium text-foreground">
          {row.operational ? "Conta aprovada no portal" : "Vínculo operacional não comprovado nesta fonte"}
        </span>
      </li>)}
    </ul>}
    {!loading && !failed && results.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nenhum registro corresponde à busca.</p>}
    {!failed && moreLegacy && <button type="button" disabled={loading} onClick={() => setLegacyPage((n) => n + 1)}
      className="mt-4 min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-50">
      {loading ? "Carregando…" : "Carregar mais técnicos WordPress"}
    </button>}
    {!failed && moreOperational && <button type="button" disabled={loading} onClick={() => setOperationalPage((n) => n + 1)}
      className="mt-4 ml-2 min-h-11 rounded-lg border border-input px-4 text-sm font-semibold text-foreground disabled:opacity-50">
      {loading ? "Carregando…" : "Carregar mais técnicos do portal"}
    </button>}
    <p className="mt-4 text-xs text-muted-foreground">
      Gestão auditada disponível abaixo para contas do portal e fichas WordPress. Inclusão manual,
      importação com contatos e edição do Guiafix dependem da API administrativa de cadastro ainda não publicada.
    </p>
  </section>;
}
