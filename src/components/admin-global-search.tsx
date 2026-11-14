import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Search, ArrowUpRight, X, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_SECTIONS, type AdminModule } from "@/lib/admin-sections";
import { adminResultHref, cleanAdminQuery } from "@/lib/admin-search";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";

const db = supabase as unknown as SupabaseClient;
const captures = import.meta.glob("../../data/external-staging/guiafix-*.capture.json", {
  eager: true, import: "default",
}) as Record<string, unknown>;
const importedTechnicians = readGuiafixStaging(Object.values(captures));

type SearchHit = {
  key: string;
  label: string;
  detail: string;
  module: AdminModule;
  filter: string;
};

async function searchRecords(term: string): Promise<{ hits: SearchHit[]; failed: number }> {
  const jobs: Array<Promise<SearchHit[]>> = [
    Promise.resolve(db.rpc("eut_admin_technician_registry_list", { _search: term, _limit: 8, _offset: 0 }))
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as Array<{ source_id: string; display_name: string; city?: string; uf?: string }>).map((row) => ({
          key: `technician:${row.source_id}`, label: row.display_name,
          detail: [row.city, row.uf].filter(Boolean).join("/") || "Técnico",
          module: "tecnicos" as const, filter: row.display_name,
        }));
      }),
    Promise.resolve(db.from("technicians").select("id,display_name,city,state_uf")
      .ilike("display_name", `%${term}%`).order("display_name").limit(8))
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as Array<{ id: string; display_name: string; city: string; state_uf: string | null }>).map((row) => ({
          key: `technician:portal:${row.id}`, label: row.display_name,
          detail: [row.city, row.state_uf].filter(Boolean).join("/") || "Técnico",
          module: "tecnicos" as const, filter: row.display_name,
        }));
      }),
    Promise.resolve(db.from("legacy_review_profiles").select("wp_post_id,title,location1")
      .eq("source_key", "wordpress_20261108").eq("kind", "candidate")
      .ilike("title", `%${term}%`).order("title").limit(8))
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as Array<{ wp_post_id: number; title: string; location1: string | null }>).map((row) => ({
          key: `technician:wp:${row.wp_post_id}`, label: row.title,
          detail: row.location1 || "Técnico",
          module: "tecnicos" as const, filter: row.title,
        }));
      }),
    Promise.resolve(db.from("service_requests").select("id,title,city,category,status")
      .or(["title", "city", "category"].map((field) => `${field}.ilike.%${term}%`).join(","))
      .order("created_at", { ascending: false }).limit(8))
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as Array<{ id: string; title: string; city: string; category: string; status: string }>).map((row) => ({
          key: `request:${row.id}`, label: row.title,
          detail: `${row.city} · ${row.category} · ${row.status}`,
          module: "solicitacoes" as const, filter: row.title,
        }));
      }),
    Promise.resolve(db.from("contact_messages").select("id,subject,name,status")
      .or(["subject", "name"].map((field) => `${field}.ilike.%${term}%`).join(","))
      .order("created_at", { ascending: false }).limit(8))
      .then(({ data, error }) => {
        if (error) throw error;
        return ((data ?? []) as Array<{ id: string; subject: string; name: string; status: string }>).map((row) => ({
          key: `message:${row.id}`, label: row.subject,
          detail: `${row.name} · ${row.status}`,
          module: "mensagens" as const, filter: row.subject,
        }));
      }),
    Promise.resolve(db.rpc("eut_admin_accounts_snapshot", { _search: term, _filter: "todos", _page: 0 }))
      .then(({ data, error }) => {
        if (error || !Array.isArray(data?.accounts)) throw error ?? Error("accounts unavailable");
        return (data.accounts as Array<{ id: string; full_name: string; is_client: boolean }>).slice(0, 8).map((row) => ({
          key: `account:${row.id}`, label: row.full_name || "Conta sem nome",
          detail: row.is_client ? "Cliente" : "Conta cadastrada",
          module: "contas" as const, filter: row.full_name,
        }));
      }),
  ];
  const settled = await Promise.allSettled(jobs);
  const dedup = new Map<string, SearchHit>();
  for (const row of importedTechnicians.filter((item) =>
    normalizeGuiafixSearch(`${item.name} ${item.city} ${item.uf}`)
      .includes(normalizeGuiafixSearch(term))).slice(0, 8)) {
    const hit: SearchHit = { key: `technician:capture:${row.key}`, label: row.name,
      detail: [row.city, row.uf].filter(Boolean).join("/") || "Técnico",
      module: "tecnicos", filter: row.name };
    dedup.set(`${hit.module}:${hit.label.toLocaleLowerCase("pt-BR")}:${hit.detail}`, hit);
  }
  for (const result of settled) if (result.status === "fulfilled") {
    for (const hit of result.value) if (hit.label) {
      const identity = `${hit.module}:${hit.label.toLocaleLowerCase("pt-BR")}:${hit.detail}`;
      if (!dedup.has(identity)) dedup.set(identity, hit);
    }
  }
  return { hits: [...dedup.values()].slice(0, 30), failed: settled.filter((result) => result.status === "rejected").length };
}

/** Mounted only after admin role confirmation; data access is still guarded by RLS/RPCs. */
export function AdminGlobalSearch() {
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [failed, setFailed] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); input.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(cleanAdminQuery(draft)), 300);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    let active = true;
    if (term.length < 2) { setHits([]); setFailed(0); setLoading(false); return; }
    setLoading(true);
    void searchRecords(term).then((result) => {
      if (active) { setHits(result.hits); setFailed(result.failed); }
      }).catch(() => { if (active) { setHits([]); setFailed(6); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [term]);

  const modules = ADMIN_SECTIONS.filter((section) => section.key !== "inicio" &&
    (term.length < 2 || `${section.label} ${section.description}`.toLocaleLowerCase("pt-BR")
      .includes(term.toLocaleLowerCase("pt-BR"))));

  return <section className="mt-5 rounded-2xl border border-primary/25 bg-background p-4 shadow-sm sm:p-5"
    aria-label="Pesquisa global da administração">
    <div className="flex items-center gap-2">
      <Search className="h-5 w-5 text-primary" aria-hidden="true" />
      <h2 className="text-base font-bold">Pesquisar todo o painel</h2>
      <kbd className="ml-auto hidden rounded border border-border px-2 py-1 text-xs text-muted-foreground sm:inline">Ctrl K</kbd>
    </div>
    <div className="mt-3 flex min-w-0 items-center rounded-xl border border-input bg-card focus-within:ring-2 focus-within:ring-primary/40">
      <label htmlFor="admin-global-search" className="sr-only">Buscar técnicos, contas, solicitações, mensagens ou módulos</label>
      <input id="admin-global-search" ref={input} value={draft} onChange={(event) => setDraft(event.target.value)}
        placeholder="Técnico, cliente, pedido, mensagem ou módulo…" maxLength={70}
        className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none sm:text-base" />
      {draft && <button type="button" onClick={() => { setDraft(""); input.current?.focus(); }}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg" aria-label="Limpar pesquisa"><X className="h-4 w-4" /></button>}
    </div>
    {term.length >= 2 && <div className="mt-4 space-y-3" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {loading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Pesquisando registros autorizados…</>
          : `${hits.length} resultado(s) encontrado(s) nos módulos consultados`}
      </div>
      {failed > 0 && !loading && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
        {failed} fonte(s) indisponível(is). A pesquisa pode estar incompleta; nenhuma ausência foi considerada definitiva.
      </p>}
      {hits.length > 0 && <ul className="grid gap-2 sm:grid-cols-2" aria-label="Resultados da pesquisa global">
        {hits.map((hit) => <li key={hit.key}>
          <a href={adminResultHref(hit.module, hit.filter)}
            className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="min-w-0"><strong className="block truncate text-sm">{hit.label}</strong>
              <span className="block truncate text-xs text-muted-foreground">{hit.detail} · {ADMIN_SECTIONS.find((item) => item.key === hit.module)?.label}</span></span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          </a>
        </li>)}</ul>}
    </div>}
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Módulos pesquisáveis">
      {modules.slice(0, term.length < 2 ? 5 : 10).map((module) => <a key={module.key} href={`/admin/${module.key}`}
        className="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-primary hover:text-primary">
        {module.label}
      </a>)}
    </div>
  </section>;
}
