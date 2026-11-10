import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/page-placeholder";

type HistoricalEmployer = { wp_post_id: number; slug: string; display_name: string | null };
const LIMIT = 10;
const archiveDb = supabase as unknown as SupabaseClient;

// Published old names/slugs only: archive, not a current client directory.
// No phone, WhatsApp, email, review, old plugin scripts or privileged keys.
export const Route = createFileRoute("/lista-de-clientes")({
  validateSearch: (raw: Record<string, unknown>) => ({
    employer_page: Math.max(1, Math.min(100, Math.trunc(Number(raw["employer_page"]) || 1))),
  }),
  head: () => ({
    meta: [
      { title: "Arquivo de clientes e empresas — Encontre um Técnico" },
      { name: "description", content: "Pré-cadastros históricos preservados em validação, sem contato público." },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: "https://www.encontreumtecnico.com/lista-de-clientes" }],
  }),
  component: HistoricalClientDirectory,
});

function HistoricalClientDirectory() {
  const { employer_page: page } = Route.useSearch();
  const navigate = useNavigate({ from: "/lista-de-clientes" });
  const [draft, setDraft] = useState("");
  const [term, setTerm] = useState("");
  const [entries, setEntries] = useState<HistoricalEmployer[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    async function load() {
      try {
        let query = archiveDb.from("eut_legacy_url_routes")
          .select("wp_post_id,slug,display_name", { count: "exact" })
          .eq("kind", "employer")
          .eq("status", "em_validacao")
          .order("wp_post_id", { ascending: false });
        const safeTerm = term.trim().replace(/[%_,().]/g, "").slice(0, 60);
        if (safeTerm) query = query.ilike("display_name", "%" + safeTerm + "%");
        const result = await query.range((page - 1) * LIMIT, page * LIMIT - 1);
        if (!mounted) return;
        if (result.error) throw result.error;
        setEntries((result.data ?? []) as HistoricalEmployer[]);
        setCount(result.count ?? 0);
      } catch {
        if (mounted) { setEntries([]); setCount(0); setError(true); }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [page, term]);

  const totalPages = Math.max(1, Math.ceil(count / LIMIT));
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTerm(draft);
    void navigate({ search: { employer_page: 1 } });
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <nav aria-label="Navegação histórica" className="text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">Início</Link>
          <span aria-hidden="true"> / </span>Arquivo histórico
        </nav>
        <header className="mt-5 rounded-2xl border border-border bg-gradient-to-br from-accent to-background p-6 md:p-8">
          <span className="inline-flex rounded-full border border-amber-700/30 bg-amber-800/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">Pioneiros Bronze · pré-cadastros</span>
          <h1 className="mt-3 text-2xl font-bold text-foreground md:text-3xl">Clientes e empresas do portal anterior</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Estes são registros históricos em validação, não clientes ativos ou solicitações.
            Telefones, e-mails, avaliações e formulários WordPress não foram republicados.
            O novo portal tem regras, serviços e hierarquias próprios.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/area-cliente" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">Registrar necessidade como cliente</Link>
            <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }} className="inline-flex min-h-11 items-center rounded-md border border-input bg-card px-5 text-sm font-semibold text-foreground">Procurar técnicos ativos</Link>
          </div>
        </header>
        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground" aria-label="Filtros históricos">
            <h2 className="font-semibold text-card-foreground">Situação</h2>
            <p className="mt-3">Origem: portal anterior</p>
            <p className="mt-2">Status: em validação</p>
            <p className="mt-4">Setor, cidade e região precisam de confirmação. Não são inferidos dos registros WordPress.</p>
          </aside>
          <div>
            <form onSubmit={search} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4" role="search">
              <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
                Buscar pelo nome antigo
                <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} placeholder="Cliente ou empresa"
                  className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground" />
              </label>
              <button type="submit" className="min-h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">Buscar</button>
            </form>
            <p className="my-5 text-sm text-muted-foreground" role="status">
              {loading ? "Consultando arquivo histórico…" : error ? "Arquivo temporariamente indisponível." :
                count + " pré-cadastros históricos · página " + page + " de " + totalPages}
            </p>
            {!loading && !error && entries.length === 0 && <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhum registro nesta página ou pesquisa. Isso não impede criar uma nova conta.</p>}
            {!loading && !error && entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((entry) => (
                  <li key={entry.wp_post_id} className="eut-card-lift rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground">
                        {entry.display_name?.trim().slice(0, 1).toLocaleUpperCase("pt-BR") || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-semibold text-card-foreground">{entry.display_name || "Cadastro em validação"}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Pioneiro Bronze · titularidade e disponibilidade a confirmar</p>
                      </div>
                      <Link to="/cliente/$slug" params={{ slug: entry.slug }}
                        className="inline-flex min-h-11 items-center rounded-md border border-primary px-4 text-sm font-medium text-primary hover:bg-primary/5">
                        Ver referência
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label="Paginação do arquivo de clientes" className="mt-6 flex items-center justify-between gap-3">
              <button type="button" disabled={page <= 1 || loading} onClick={() => void navigate({ search: { employer_page: page - 1 } })}
                className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground disabled:opacity-40">Anterior</button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => void navigate({ search: { employer_page: page + 1 } })}
                className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground disabled:opacity-40">Próxima</button>
            </nav>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
