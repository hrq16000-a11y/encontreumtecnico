import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Search, ArrowUpRight, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { normalizeGuiafixSearch, readGuiafixStaging } from "@/lib/guiafix-staging-normalizer";
import {
  adminSearchUrl,
  cleanAdminSearch,
  importedTechnicianSearchResult,
  matchingAdminModules,
  type AdminSearchResult,
} from "@/lib/admin-global-search";

const db = supabase as unknown as SupabaseClient;
const captures = import.meta.glob("../../data/external-staging/guiafix-*.capture.json", {
  eager: true, import: "default",
}) as Record<string, unknown>;
const importedTechnicians = readGuiafixStaging(Object.values(captures));

type SearchResponse = { items: AdminSearchResult[]; unavailable: boolean };

/** Searches only metadata and bounded admin-authorized rows. No emails, phones or message bodies. */
async function findRecords(term: string): Promise<SearchResponse> {
  const like = `%${term}%`;
  const jobs = await Promise.allSettled([
    db
      .from("technicians")
      .select("id,display_name,city,state_uf")
      .ilike("display_name", like)
      .order("display_name")
      .limit(6),
    db.rpc("eut_admin_technician_registry_list", { _search: term, _limit: 6, _offset: 0 }),
    db
      .from("legacy_review_profiles")
      .select("wp_post_id,title,location1")
      .eq("source_key", "wordpress_20261108")
      .eq("kind", "candidate")
      .eq("demo_candidate", false)
      .ilike("title", like)
      .order("title")
      .limit(5),
    db.rpc("eut_admin_accounts_snapshot", { _search: term, _filter: "todos", _page: 0 }),
    db
      .from("service_requests")
      .select("id,title,category,city,status")
      .ilike("title", like)
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("contact_messages")
      .select("id,subject,status")
      .neq("status", "arquivada")
      .ilike("subject", like)
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("eut_service_categories").select("slug,label,active").ilike("label", like).limit(5),
    db.from("eut_service_types").select("slug,label,active").ilike("label", like).limit(5),
    db.from("legacy_review_profiles").select("wp_post_id,title,location1")
      .eq("source_key", "wordpress_20261108").eq("kind", "employer")
      .eq("demo_candidate", false).ilike("title", like).order("title").limit(6),
  ]);
  const items: AdminSearchResult[] = [];
  let unavailable = false;
  const data = jobs.map((job) => {
    if (job.status === "rejected" || job.value.error) {
      unavailable = true;
      return null;
    }
    return job.value.data;
  });
  for (const row of (data[0] ?? []) as Array<{
    id: string;
    display_name: string;
    city: string | null;
    state_uf: string | null;
  }>) {
    items.push({
      key: `technician:${row.id}`,
      title: row.display_name,
      description: `Técnico · ${[row.city, row.state_uf].filter(Boolean).join("/") || "Localidade não informada"}`,
      section: "tecnicos",
      url: adminSearchUrl("tecnicos", row.display_name),
    });
  }
  for (const row of (data[1] ?? []) as Array<{
    technician_id: string;
    display_name: string;
    region_approx: string | null;
  }>) {
    items.push({
      key: `registry:${row.technician_id}`,
      title: row.display_name,
      description: `Técnico · ${row.region_approx || "Localidade não informada"}`,
      section: "tecnicos",
      url: adminSearchUrl("tecnicos", row.display_name),
    });
  }
  for (const row of (data[2] ?? []) as Array<{
    wp_post_id: number;
    title: string;
    location1: string | null;
  }>) {
    items.push({
      key: `historic:${row.wp_post_id}`,
      title: row.title,
      description: `Técnico · ${row.location1 || "Histórico"}`,
      section: "tecnicos",
      url: adminSearchUrl("tecnicos", row.title),
    });
  }
  const accounts = (
    data[3] as { accounts?: Array<{ id: string; full_name: string; roles: string }> } | null
  )?.accounts;
  if (data[3] && !Array.isArray(accounts)) unavailable = true;
  for (const account of (accounts ?? []).slice(0, 6)) {
    items.push({
      key: `account:${account.id}`,
      title: account.full_name || "Conta sem nome",
      description: `Conta · ${account.roles || "Sem papel"}`,
      section: "contas",
      url: adminSearchUrl("contas", undefined, account.id),
    });
  }
  for (const row of (data[4] ?? []) as Array<{
    id: string;
    title: string;
    category: string;
    city: string;
    status: string;
  }>) {
    items.push({
      key: `request:${row.id}`,
      title: row.title,
      description: `Solicitação · ${row.category} · ${row.city} · ${row.status}`,
      section: "solicitacoes",
      url: adminSearchUrl("solicitacoes", undefined, row.id),
    });
  }
  for (const row of (data[5] ?? []) as Array<{ id: string; subject: string; status: string }>) {
    items.push({
      key: `message:${row.id}`,
      title: row.subject,
      description: `Mensagem · ${row.status}`,
      section: "mensagens",
      url: adminSearchUrl("mensagens", undefined, row.id),
    });
  }
  for (const row of (data[6] ?? []) as Array<{ slug: string; label: string; active: boolean }>) {
    items.push({
      key: `category:${row.slug}`,
      title: row.label,
      description: `Categoria · ${row.active ? "Ativa" : "Oculta"}`,
      section: "catalogo",
      url: adminSearchUrl("catalogo", row.label),
    });
  }
  for (const row of (data[7] ?? []) as Array<{ slug: string; label: string; active: boolean }>) {
    items.push({
      key: `service:${row.slug}`,
      title: row.label,
      description: `Serviço · ${row.active ? "Ativo" : "Oculto"}`,
      section: "catalogo",
      url: adminSearchUrl("catalogo", row.label),
    });
  }
  for (const row of (data[8] ?? []) as Array<{ wp_post_id: number; title: string; location1: string | null }>) {
    items.push({
      key: `client-history:${row.wp_post_id}`, title: row.title,
      description: `Cliente · ${row.location1 || "Localidade não informada"}`,
      section: "clientes", url: adminSearchUrl("clientes", row.title),
    });
  }
  for (const row of importedTechnicians.filter((entry) =>
    normalizeGuiafixSearch(`${entry.name} ${entry.city} ${entry.uf}`)
      .includes(normalizeGuiafixSearch(term))).slice(0, 6)) {
    items.push(importedTechnicianSearchResult(row));
  }
  return { items, unavailable };
}

export function AdminGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<AdminSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const modules = useMemo(() => matchingAdminModules(query), [query]);
  const term = cleanAdminSearch(query);

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", shortcuts);
    return () => document.removeEventListener("keydown", shortcuts);
  }, []);

  useEffect(() => {
    if (!open || term.length < 2) {
      setRecords([]);
      setUnavailable(false);
      setBusy(false);
      return;
    }
    let current = true;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void findRecords(term)
        .then((response) => {
          if (current) {
            setRecords(response.items);
            setUnavailable(response.unavailable);
          }
        })
        .catch(() => {
          if (current) {
            setRecords([]);
            setUnavailable(true);
          }
        })
        .finally(() => {
          if (current) setBusy(false);
        });
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [open, term]);

  return (
    <>
      <button
        id="admin-global-search"
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 text-left text-sm font-semibold text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">Localizar no painel</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setQuery("");
            setRecords([]);
          }
        }}
      >
        <DialogContent className="max-h-[88dvh] w-[calc(100%-1rem)] max-w-2xl gap-3 overflow-hidden p-4 sm:p-6">
          <DialogTitle>Localizar no painel administrativo</DialogTitle>
          <DialogDescription>
            Pesquise módulos, técnicos, contas, solicitações, mensagens e catálogo. Apenas dados
            autorizados são consultados.
          </DialogDescription>
          <label className="flex min-h-12 items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Buscar na administração</span>
            <input
              autoFocus
              aria-label="Buscar na administração"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={80}
              placeholder="Nome, categoria, solicitação ou módulo…"
              className="min-w-0 w-full bg-transparent text-base text-foreground outline-none"
            />
          </label>
          <div role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {term.length < 2
              ? "Digite 2 caracteres para procurar registros. Os módulos já estão disponíveis."
              : busy
                ? "Consultando registros autorizados…"
                : unavailable
                  ? "Algumas fontes estão indisponíveis; os demais resultados continuam acessíveis."
                  : `${records.length} registro(s) localizado(s) nesta consulta limitada.`}
          </div>
          <div className="max-h-[57dvh] space-y-4 overflow-y-auto overscroll-contain pr-1">
            {modules.length > 0 && (
              <section aria-label="Módulos encontrados">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Módulos
                </h3>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {modules.map((item) => (
                    <li key={item.key}>
                      <a
                        href={item.url}
                        className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {item.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {term.length >= 2 && (
              <section aria-label="Registros encontrados">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Registros{" "}
                  {busy && <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />}
                </h3>
                {records.length > 0 ? (
                  <ul className="grid gap-1">
                    {records.map((item) => (
                      <li key={item.key}>
                        <a
                          href={item.url}
                          className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {item.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                          <ArrowUpRight
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  !busy && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum registro encontrado nas fontes disponíveis. Use um termo mais
                      específico ou abra o módulo.
                    </p>
                  )
                )}
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
