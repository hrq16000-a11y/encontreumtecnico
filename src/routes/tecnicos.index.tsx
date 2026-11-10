import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listApprovedTechnicians } from "../lib/technicians.functions";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PageShell, EmptyState } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { useActiveCategories, categoryLabel } from "@/hooks/use-active-categories";
import { useActiveServices, serviceLabel } from "@/hooks/use-active-services";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { localMatchLabel } from "@/lib/technician-local-ranking";
import { LegacyPublicArchive } from "../components/legacy-public-archive";
import { canShowLegacyArchive } from "../lib/legacy-archive-filters";
import { useEffect, useRef, useState } from "react";
import { analyticsAllowed, recordSearch } from "@/lib/search-analytics";

const searchSchema = z.object({
  especialidade: fallback(z.string(), "Todas").default("Todas"),
  cidade: fallback(z.string(), "").default(""),
  regiao: fallback(z.string(), "").default(""),
  servico: fallback(z.string(), "").default(""),
  uf: fallback(z.string(), "").default(""),
  bairro: fallback(z.string(), "").default(""),
  prioridade: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/tecnicos/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listApprovedTechnicians({ data: deps }),
  head: () => ({
    meta: [
      { title: "Técnicos de CFTV, informática e redes — Encontre um Técnico" },
      { name: "description", content: "Consulte técnicos com perfil público de CFTV, informática, redes e impressoras. Filtre por serviço, UF, cidade e bairro." },
      { property: "og:title", content: "Técnicos de CFTV, informática e redes — Encontre um Técnico" },
      { property: "og:description", content: "Consulte técnicos com perfil público de CFTV, informática, redes e impressoras. Filtre por serviço, UF, cidade e bairro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://www.encontreumtecnico.com/tecnicos" },
    ],
    links: [{ rel: "canonical", href: "https://www.encontreumtecnico.com/tecnicos" }],
  }),
  component: TechniciansPage,
});

function trackFilter(filter: "especialidade" | "cidade" | "regiao" | "servico" | "uf" | "bairro", value: string) {
  if (!analyticsAllowed(localStorage.getItem("eut-cookie-consent"))) return;
  window.__lovableEvents?.track?.("project.technician_filter_used", {
    filter,
    has_value: value.trim() !== "" && value !== "Todas",
    ...(filter === "especialidade" ? { category: value } : {}),
  });
}

function TechniciansPage() {
  const search = Route.useSearch();
  const { categories, loading: catalogLoading } = useActiveCategories();
  const { services, loading: servicesLoading } = useActiveServices();
  const technicians = Route.useLoaderData();
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
  }, [search.especialidade, search.cidade, search.regiao, search.servico, search.uf, search.bairro, search.prioridade, technicians.length, consentRevision]);
  const prioritizeRegion = search.prioridade === "regiao" && Boolean(search.uf || search.cidade.trim());
  const hasDeclaredLocation = Boolean(search.uf || search.cidade.trim());
  const specialty = categories.some((c) => c.slug === search.especialidade)
    ? search.especialidade
    : "Todas";

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Técnicos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Perfis publicados são declarados pelos próprios profissionais. A plataforma não certifica habilidades nem garante atendimento.
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
                update({ especialidade: e.target.value, servico: "" });
                trackFilter("especialidade", e.target.value);
              }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              disabled={catalogLoading}
            >
              <option value="Todas">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-servico" className="text-xs font-medium text-muted-foreground">Serviço específico</label>
            <select id="filtro-servico" value={services.some((service) => service.slug === search.servico) ? search.servico : ""}
              onChange={(e) => { update({ servico: e.target.value }); trackFilter("servico", e.target.value); }}
              disabled={servicesLoading} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Todos os serviços</option>
              {services.filter((service) => specialty === "Todas" || service.category_slug === specialty).map((service) => (
                <option key={service.slug} value={service.slug}>{service.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-uf" className="text-xs font-medium text-muted-foreground">Estado (UF)</label>
            <select id="filtro-uf" value={search.uf} onChange={(e) => { update({ uf: e.target.value }); trackFilter("uf", e.target.value); }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Todos os estados</option>
              {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
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
            <label htmlFor="filtro-bairro" className="text-xs font-medium text-muted-foreground">Bairro</label>
            <input id="filtro-bairro" type="text" value={search.bairro}
              onChange={(e) => update({ bairro: e.target.value })} onBlur={(e) => trackFilter("bairro", e.target.value)}
              placeholder="Ex.: Centro" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" />
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox" checked={prioritizeRegion}
              disabled={!hasDeclaredLocation}
              onChange={(event) => update({ prioridade: event.target.checked ? "regiao" : "" })}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              <strong>Priorizar minha região</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                Mostra primeiro profissionais com bairro, município e UF correspondentes aos dados
                informados e, depois, alternativas de outras regiões. A presença online desempata
                profissionais na mesma faixa de localização.
              </span>
            </span>
          </label>
          {!hasDeclaredLocation && (
            <p className="text-xs text-muted-foreground">Informe o estado (UF) ou município para ativar.</p>
          )}
          {prioritizeRegion && (
            <p role="status" className="text-xs text-muted-foreground">
              Afinidade por endereço declarado; não é localização GPS ou distância em quilômetros.
            </p>
          )}
        </div>
        <SponsoredPublicSlot slotKey="search.top" routePath="/tecnicos" />
        <div className="mt-6">
          {technicians.length === 0 ? (
            <EmptyState
              title="Nenhum técnico encontrado"
              description="Ainda não há perfis públicos que correspondam aos filtros. Cadastros WordPress em migração podem aparecer abaixo como registros históricos, sem contato disponível."
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
                      {t.online_now ? (
                        <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Online recentemente</span>
                      ) : (
                        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Perfil público</span>
                      )}
                    </div>
                    {prioritizeRegion && localMatchLabel(t, {
                      uf: search.uf, cidade: search.cidade, bairro: search.bairro,
                    }) && (
                      <p className="mt-2 text-xs font-semibold text-primary">
                        {localMatchLabel(t, { uf: search.uf, cidade: search.cidade, bairro: search.bairro })}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.city}{t.state_uf ? `/${t.state_uf}` : ""}{t.neighborhood ? ` · ${t.neighborhood}` : ""}{t.region ? ` · ${t.region}` : ""}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {t.specialties.map((s) => (
                        <li key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">{categoryLabel(s, categories)}</li>
                      ))}
                      {t.service_slugs.map((slug) => (
                        <li key={slug} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{serviceLabel(slug, services)}</li>
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
