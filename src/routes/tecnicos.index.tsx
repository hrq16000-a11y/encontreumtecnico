import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listApprovedTechnicians } from "../lib/technicians.functions";
import { TechnicianSearchCard } from "@/components/technician-search-card";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { PageShell, EmptyState } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { useActiveCategories, categoryLabel } from "@/hooks/use-active-categories";
import { useActiveServices, serviceLabel } from "@/hooks/use-active-services";
import { DebouncedTextFilter } from "@/components/debounced-text-filter";
import { CustomerLocationButton } from "@/components/customer-location-button";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { neighborhoodCatalogFor, neighborhoodOptions } from "@/lib/neighborhood-sources";
import { localMatchLabel } from "@/lib/technician-local-ranking";
import { LegacyPublicArchive } from "../components/legacy-public-archive";
import { canShowLegacyArchive } from "../lib/legacy-archive-filters";
import { useEffect, useRef, useState } from "react";
import { analyticsAllowed, recordSearch } from "@/lib/search-analytics";
import { openFreeHelp } from "@/lib/free-search-help";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { MapPin, ShieldCheck, UserRoundCheck, LifeBuoy } from "lucide-react";

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
      { property: "og:url", content: "https://www.encontreumtecnico.com.br/tecnicos" },
    ],
    links: [{ rel: "canonical", href: "https://www.encontreumtecnico.com.br/tecnicos" }],
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

  const searchArea = [search.bairro, search.cidade, search.uf].filter(Boolean).join(" · ");
  const bairroCatalog = neighborhoodCatalogFor({ city: search.cidade, uf: search.uf });
  const helpContext = { city: search.cidade, uf: search.uf, neighborhood: search.bairro,
    service: services.find((s) => s.slug === search.servico)?.label || search.servico || (search.especialidade !== "Todas" ? search.especialidade : "") };

  useEffect(() => {
    if (technicians.length > 0 || !searchArea) return;
    // One contextual invitation per browser tab; never nag on every filter.
    const popup = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem("eut-free-help-invite") === "seen") return;
        sessionStorage.setItem("eut-free-help-invite", "seen");
      } catch { /* Session storage unavailable: the button remains available. */ }
      openFreeHelp({ city: search.cidade, uf: search.uf, neighborhood: search.bairro, service: search.servico });
    }, 850);
    return () => window.clearTimeout(popup);
  }, [technicians.length, searchArea, search.cidade, search.uf, search.bairro, search.servico]);

  const { area: regionalHint } = useRegionalSuggestion();
  const suggestedArea = !search.cidade.trim() && !search.uf ? regionalHint : null;
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

        <div className="mt-4">
          <CustomerLocationButton onLocated={(area, source) => {
            if (source === "automatic" && (search.cidade.trim() || search.uf || search.bairro.trim())) return;
            void update({ uf: area.uf, cidade: area.city, bairro: area.neighborhood,
              regiao: "", prioridade: "regiao" });
          }} />
        </div>
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
          <DebouncedTextFilter
            id="filtro-cidade"
            label="Cidade"
            value={search.cidade}
            placeholder="Ex.: São Paulo"
            onCommit={(value) => update({ cidade: value })}
            onBlurTrack={(value) => trackFilter("cidade", value)}
          />
          <DebouncedTextFilter
            id="filtro-bairro"
            label="Bairro"
            list={bairroCatalog ? "eut-bairro-diretorio" : undefined}
            value={search.bairro}
            placeholder="Ex.: Centro"
            onCommit={(value) => update({ bairro: value })}
            onBlurTrack={(value) => trackFilter("bairro", value)}
          />
          {bairroCatalog && <div className="text-xs text-muted-foreground sm:col-span-3">
            <datalist id="eut-bairro-diretorio">
              {neighborhoodOptions(bairroCatalog).map(bairro => <option key={bairro} value={bairro} />)}
            </datalist>
            Bairros sugeridos pela <a className="text-primary underline" href={bairroCatalog.sourceUrl}
              target="_blank" rel="noopener noreferrer">prefeitura</a>; você pode digitar outra denominação.
          </div>}
          <DebouncedTextFilter
            id="filtro-regiao"
            label="Região"
            value={search.regiao}
            placeholder="Ex.: Zona Sul"
            onCommit={(value) => update({ regiao: value })}
            onBlurTrack={(value) => trackFilter("regiao", value)}
          />
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
        {suggestedArea && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm">
            <span><MapPin className="mr-1 inline h-4 w-4 text-primary" aria-hidden="true" />
              Você pode estar perto de <strong>{suggestedArea.city}/{suggestedArea.uf}</strong>. Estimativa por IP, não localização exata.</span>
            <Link to="/tecnicos" search={{especialidade:search.especialidade,cidade:suggestedArea.city,uf:suggestedArea.uf,bairro:suggestedArea.neighborhood,regiao:"",servico:search.servico,prioridade:"regiao"}}
              className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">Buscar na região</Link>
          </div>
        )}
        <SponsoredPublicSlot slotKey="search.top" routePath="/tecnicos" />
        <section aria-label="Transparência e confiança na busca" className="mt-6 grid gap-3 rounded-2xl border border-primary/15 bg-accent/50 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-foreground"><strong className="block">{technicians.length} perfil{technicians.length === 1 ? "" : "s"} nesta busca</strong><span className="text-xs text-muted-foreground">Somente perfis publicados; resultados conforme os filtros aplicados.</span></p></div>
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-foreground"><strong className="block">Localidade informada</strong><span className="text-xs text-muted-foreground">Regiões declaradas pelos profissionais, sem localização inventada.</span></p></div>
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-foreground"><strong className="block">Contato protegido</strong><span className="text-xs text-muted-foreground">Telefones particulares não aparecem na busca pública.</span></p></div>
        </section>
        <div className="mt-6">
          {technicians.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                title="Nenhum técnico encontrado com estes filtros"
                description="Ainda não encontramos um profissional com perfil ativo para esta pesquisa. Você pode registrar sua necessidade ou, se é profissional, criar seu perfil no portal novo. Cadastros antigos em conferência não são apresentados como técnicos disponíveis."
              />
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-r from-brand-navy to-primary p-6 text-white shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/75"><LifeBuoy className="h-4 w-4" aria-hidden="true" /> Ajuda da equipe · gratuita nesta fase</p>
                    <h2 className="mt-2 text-xl font-bold text-white">Não encontrou técnico{searchArea ? " em " + searchArea : " para sua necessidade"}?</h2>
                    <p className="mt-2 max-w-xl text-sm text-white/85">Conte o que você precisa. Recebemos seu pedido de ajuda sem cobrar. Não há promessa de disponibilidade nem liberação de contato privado.</p>
                  </div>
                  <button type="button" onClick={() => openFreeHelp(helpContext)}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-white/90">
                    <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Pedir ajuda grátis
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-5">
                  <h2 className="text-base font-semibold text-card-foreground">
                    Precisa de atendimento?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Registre sua necessidade na área do cliente. Se você já usou a triagem,
                    sua descrição poderá ser recuperada após o login.
                    Esse registro é privado: não envia mensagens a profissionais,
                    não reserva atendimento e não libera contatos.
                    A solicitação só é compartilhada quando o cliente escolher
                    um técnico e autorizar explicitamente.
                  </p>
                  <Link
                    to="/area-cliente"
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Registrar minha necessidade
                  </Link>
                </div>
                <div className="rounded-lg border border-border bg-card p-5">
                  <h2 className="text-base font-semibold text-card-foreground">
                    Você é técnico e quer ser encontrado?
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Cadastre-se gratuitamente no novo portal. Escolha os serviços que
                    realmente executa, sua cidade e regiões atendidas.
                    Não precisa ter tido conta no site anterior.
                  </p>
                  <Link
                    to="/entrar"
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                  >
                    Criar meu perfil profissional
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {technicians.map((t) => (
                <li key={t.id} className="min-w-0">
                  <TechnicianSearchCard
                    technician={t}
                    categories={categories}
                    services={services}
                    localMatch={prioritizeRegion ? localMatchLabel(t, {
                      uf: search.uf, cidade: search.cidade, bairro: search.bairro,
                    }) : null}
                  />
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
