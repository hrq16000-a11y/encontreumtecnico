import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listApprovedTechnicians, listPublicServiceCatalog } from "../lib/technicians.functions";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PageShell, EmptyState } from "../components/page-placeholder";
import { BRAZIL_STATES } from "../lib/service-taxonomy";
import { LegacyPublicArchive } from "../components/legacy-public-archive";
import { canShowLegacyArchive } from "../lib/legacy-archive-filters";
import { useEffect, useRef, useState } from "react";
import { analyticsAllowed, recordSearch } from "@/lib/search-analytics";

const LEGACY_CATEGORY_FILTERS: Record<string,string> = {
  "Ar-condicionado": "climatizacao", "Automação": "automacao", "CFTV": "cftv",
  "Computador": "computadores", "Comunicações": "comunicacoes",
  "Elétrica": "eletrica", "Gráfica": "design-grafico", "Impressora": "impressoras",
};

const searchSchema = z.object({
  especialidade: fallback(z.string(), "Todas").default("Todas"),
  cidade: fallback(z.string(), "").default(""),
  regiao: fallback(z.string(), "").default(""),
  uf: fallback(z.string(), "").default(""),
  bairro: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/tecnicos/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [technicians, catalog] = await Promise.all([
      listApprovedTechnicians({ data: deps }),
      listPublicServiceCatalog(),
    ]);
    return { technicians, catalog };
  },
  head: () => ({
    meta: [
      { title: "Técnicos de CFTV, informática e redes — Encontre um Técnico" },
      { name: "description", content: "Lista de técnicos aprovados de CFTV, informática, redes e impressoras. Filtre por especialidade, cidade e região." },
      { property: "og:title", content: "Técnicos de CFTV, informática e redes — Encontre um Técnico" },
      { property: "og:description", content: "Lista de técnicos aprovados de CFTV, informática, redes e impressoras. Filtre por especialidade, cidade e região." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://find-your-trusted-technician.lovable.app/tecnicos" },
    ],
    links: [{ rel: "canonical", href: "https://find-your-trusted-technician.lovable.app/tecnicos" }],
  }),
  component: TechniciansPage,
});

function trackFilter(filter: "especialidade" | "cidade" | "regiao" | "uf" | "bairro", value: string) {
  if (!analyticsAllowed(localStorage.getItem("eut-cookie-consent"))) return;
  window.__lovableEvents?.track?.("project.technician_filter_used", {
    filter,
    has_value: value.trim() !== "" && value !== "Todas",
    ...(filter === "especialidade" ? { category: value } : {}),
  });
}

function TechniciansPage() {
  const search = Route.useSearch();
  const { technicians, catalog } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/tecnicos/" });
  const lastRecorded = useRef("");
  const [consentRevision, setConsentRevision] = useState(0);
  useEffect(() => {
    const changed = () => setConsentRevision(value => value + 1);
    window.addEventListener("eut-consent-changed", changed);
    return () => window.removeEventListener("eut-consent-changed", changed);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      const key = JSON.stringify(search);
      if (key === lastRecorded.current || !analyticsAllowed(localStorage.getItem("eut-cookie-consent"))) return;
      lastRecorded.current = key;
      void recordSearch({ ...search, resultCount: technicians.length });
    }, 800);
    return () => clearTimeout(timer);
  }, [search.especialidade, search.cidade, search.regiao, search.uf, search.bairro, technicians.length, consentRevision]);
  const requested = LEGACY_CATEGORY_FILTERS[search.especialidade]
    ? `cat:${LEGACY_CATEGORY_FILTERS[search.especialidade]}`
    : search.especialidade;
  const specialty = requested === "Todas" ||
    (requested.startsWith("cat:") && catalog.categories.some(c => `cat:${c.slug}` === requested)) ||
    (requested.startsWith("svc:") && catalog.services.some(s => `svc:${s.slug}` === requested))
    ? requested : "Todas";

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Técnicos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apenas perfis aprovados pela plataforma aparecem nesta listagem.
        </p>

        <div className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
          <div>
            <label htmlFor="filtro-especialidade" className="text-xs font-medium text-muted-foreground">
              Especialidade
            </label>
            <select
              id="filtro-especialidade"
              value={specialty}
              onChange={(e) => {
                update({ especialidade: e.target.value });
                trackFilter("especialidade", e.target.value);
              }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="Todas">Todas as categorias e serviços</option>
              {catalog.categories.map((category) => (
                <optgroup key={category.slug} label={category.label}>
                  <option value={`cat:${category.slug}`}>{category.label} — todos os serviços</option>
                  {catalog.services.filter(s => s.category_slug === category.slug).map(service => (
                    <option key={service.slug} value={`svc:${service.slug}`}>{service.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-cidade" className="text-xs font-medium text-muted-foreground">
              Cidade
            </label>
            <input
              id="filtro-cidade"
              type="text"
              value={search.cidade}
              onChange={(e) => update({ cidade: e.target.value })}
              onBlur={(e) => trackFilter("cidade", e.target.value)}
              placeholder="Ex.: São Paulo"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label htmlFor="filtro-uf" className="text-xs font-medium text-muted-foreground">
              Estado (UF)
            </label>
            <select
              id="filtro-uf"
              value={search.uf.toUpperCase()}
              onChange={(e) => { update({ uf: e.target.value }); trackFilter("uf", e.target.value); }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Todos os estados</option>
              {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-bairro" className="text-xs font-medium text-muted-foreground">
              Bairro
            </label>
            <input
              id="filtro-bairro"
              type="text"
              value={search.bairro}
              onChange={(e) => update({ bairro: e.target.value })}
              onBlur={(e) => trackFilter("bairro", e.target.value)}
              placeholder="Ex.: Centro"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label htmlFor="filtro-regiao" className="text-xs font-medium text-muted-foreground">
              Região
            </label>
            <input
              id="filtro-regiao"
              type="text"
              value={search.regiao}
              onChange={(e) => update({ regiao: e.target.value })}
              onBlur={(e) => trackFilter("regiao", e.target.value)}
              placeholder="Ex.: Zona Sul"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="mt-6">
          {technicians.length === 0 ? (
            <EmptyState
              title="Nenhum técnico encontrado"
              description="Ainda não há técnicos aprovados com esses filtros. Os registros importados do WordPress aparecem abaixo, separados e em validação."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {technicians.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/tecnicos/$tecnicoId"
                    params={{ tecnicoId: t.id }}
                    className="block h-full rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-card-foreground">{t.display_name}</h2>
                      <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Aprovado</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.city}{t.state_uf ? `/${t.state_uf}` : ""}{t.neighborhood ? ` · ${t.neighborhood}` : ""}{t.region ? ` · ${t.region}` : ""}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {t.specialties.map((s) => (
                        <li key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">{s}</li>
                      ))}
                    </ul>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <LegacyPublicArchive show={canShowLegacyArchive(search)} />
      </section>
    </PageShell>
  );
}
