import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { listApprovedTechnicians, listApprovedMunicipalTechnicians } from "../lib/technicians.functions";
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
import { technicianSearchAfterUfChange } from "@/lib/technician-search-uf-transition";
import { neighborhoodCatalogFor, neighborhoodOptions } from "@/lib/neighborhood-sources";
import { localMatchLabel } from "@/lib/technician-local-ranking";
import { LegacyPublicArchive } from "../components/legacy-public-archive";
import { canShowLegacyArchive } from "../lib/legacy-archive-filters";
import { useEffect, useRef, useState } from "react";
import { analyticsAllowed, recordSearch } from "@/lib/search-analytics";
import { openFreeHelp } from "@/lib/free-search-help";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { useMunicipalities } from "@/hooks/use-municipalities";
import { ArrowRight, ChevronDown, ListFilter, MapPin, Search, ShieldCheck, SlidersHorizontal, UserRoundCheck, LifeBuoy, X } from "lucide-react";

/** Small contextual help inside *filtered directory results*, not a second blog.
 * Avoid importing the full editorial catalogue into the default search bundle.
 */
const CATEGORY_SEARCH_CONTEXT: Record<string, { title: string; advice: string }> = {
  automacao: {
    title: "Automação de ambientes e rotinas",
    advice: "Informe funções desejadas, equipamentos atuais e se a instalação precisa operar sem internet. Nunca envie senhas ou códigos de autenticação ao solicitar atendimento.",
  },
  comunicacoes: {
    title: "Interfonia, ramais e telefonia IP",
    advice: "Indique quantidade aproximada de pontos, central existente, problemas de rede e uso interno ou externo. Evite divulgar gravações e credenciais da operadora.",
  },
  computadores: {
    title: "Lentidão, diagnóstico e manutenção",
    advice: "Anote travamentos, lentidão em programas e sinais de aquecimento. Confirme o backup antes de autorizar formatação ou troca de peças.",
  },
  cftv: {
    title: "Câmeras, gravação e instalação",
    advice: "Explique as áreas que precisam de cobertura, iluminação, armazenamento e infraestrutura. Respeite a privacidade dos ambientes.",
  },
  redes: {
    title: "Wi-Fi, roteadores e conexão",
    advice: "Informe onde a conexão falha, se ocorre em mais de um aparelho e se o cabo funciona. Evite divulgar senhas ou restaurar o roteador sem orientação.",
  },
  impressoras: {
    title: "Impressora offline e manutenção",
    advice: "Indique marca, modelo, tipo de conexão e mensagem de erro. Confira a fila de impressão sem expor documentos confidenciais.",
  },
  software: {
    title: "Sistemas, backup e recuperação",
    advice: "Identifique arquivos essenciais, programas e cópias testadas. Caso haja falha física no disco, evite testes repetidos que possam piorar a perda.",
  },
  climatizacao: {
    title: "Ar-condicionado sem resfriamento",
    advice: "Informe o modo selecionado, ventilação, modelo e sinais de falha. Não abra painéis elétricos nem manipule refrigerante sem profissional qualificado.",
  },
};

const searchSchema = z.object({
  especialidade: fallback(z.string(), "Todas").default("Todas"),
  cidade: fallback(z.string(), "").default(""),
  regiao: fallback(z.string(), "").default(""),
  servico: fallback(z.string(), "").default(""),
  uf: fallback(z.string(), "").default(""),
  bairro: fallback(z.string(), "").default(""),
  prioridade: fallback(z.string(), "").default(""),
  municipio_ibge: fallback(z.string(), "").default(""),
  pagina: fallback(z.coerce.number().int().min(1).max(20), 1).default(1),
});

export const Route = createFileRoute("/tecnicos/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => deps.municipio_ibge
    ? listApprovedMunicipalTechnicians({ data: deps })
    : { technicians: await listApprovedTechnicians({ data: deps }), hasMore: false },
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
  const { cities: officialCities, loading: officialLoading, error: officialError } = useMunicipalities(search.uf);
  const { technicians, hasMore } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/tecnicos/" });
  const lastRecorded = useRef("");
  const [consentRevision, setConsentRevision] = useState(0);
  // Keep advanced controls mounted to preserve debounced drafts while collapsed.
  const [showAdvanced, setShowAdvanced] = useState(
    () => Boolean(search.municipio_ibge || search.servico || search.bairro || search.regiao || search.prioridade === "regiao"),
  );
  useEffect(() => {
    if (search.municipio_ibge || search.servico || search.bairro || search.regiao || search.prioridade === "regiao") {
      setShowAdvanced(true);
    }
  }, [search.municipio_ibge, search.servico, search.bairro, search.regiao, search.prioridade]);
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
  const prioritizeRegion = !search.municipio_ibge && search.prioridade === "regiao" && Boolean(search.uf || search.cidade.trim());
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
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:pt-8">
        <div className="relative isolate overflow-hidden rounded-[28px] border border-brand-glow/20 bg-gradient-to-br from-brand-navy via-[#173d61] to-brand-navy px-5 py-7 text-brand-navy-foreground shadow-soft sm:px-8 sm:py-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-32 h-72 w-72 rounded-full bg-brand-glow/15 blur-3xl" />
          <span className="relative inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-brand-glow"><ListFilter className="h-4 w-4" aria-hidden="true" /> Diretório de profissionais</span>
          <h1 className="relative mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Encontre o técnico certo</h1>
          <p className="relative mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Escolha a especialidade e a cidade. Perfis são declarados pelos profissionais; não representam certificação nem garantia de atendimento.
          </p>
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90">
            <ShieldCheck className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Contatos particulares continuam protegidos
          </div>
        </div>

        <div className="mt-4">
          <CustomerLocationButton onLocated={(area, source) => {
            if (source === "automatic" && (search.cidade.trim() || search.uf || search.bairro.trim())) return;
            void update({ uf: area.uf, cidade: area.city, bairro: area.neighborhood,
              regiao: "", prioridade: "regiao", municipio_ibge: "", pagina: 1 });
          }} />
        </div>
        <section aria-label="Filtros da busca" className="mt-5 overflow-hidden rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-card-foreground">
            <Search className="h-5 w-5 text-primary" aria-hidden="true" /> Encontre um profissional
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="filtro-especialidade" className="text-xs font-medium text-muted-foreground">
              Especialidade
            </label>
            <select
              id="filtro-especialidade"
              value={specialty}
              onChange={(e) => {
                update({ especialidade: e.target.value, servico: "", pagina: 1 });
                trackFilter("especialidade", e.target.value);
              }}
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              disabled={catalogLoading}
            >
              <option value="Todas">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro-uf" className="text-xs font-medium text-muted-foreground">Estado (UF)</label>
            <select id="filtro-uf" value={search.uf} onChange={(e) => { update({ ...technicianSearchAfterUfChange(e.target.value, search.prioridade), municipio_ibge: "", pagina: 1 }); trackFilter("uf", e.target.value); }}
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Todos os estados</option>
              {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <DebouncedTextFilter
            key={`filtro-cidade-${search.uf}`}
            id="filtro-cidade"
            label="Cidade"
            value={search.cidade}
            placeholder="Ex.: São Paulo"
            onCommit={(value) => update({ cidade: value, municipio_ibge: "", pagina: 1 })}
            onBlurTrack={(value) => trackFilter("cidade", value)}
          />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <button type="button" aria-expanded={showAdvanced} aria-controls="filtros-avancados"
              onClick={() => setShowAdvanced(value => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-accent/60 px-4 text-sm font-bold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Mais filtros
              {[search.municipio_ibge, search.servico, search.bairro, search.regiao, prioritizeRegion ? "regiao" : ""].filter(Boolean).length > 0 &&
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {[search.municipio_ibge, search.servico, search.bairro, search.regiao, prioritizeRegion ? "regiao" : ""].filter(Boolean).length}
                </span>}
              <ChevronDown className={"h-4 w-4 transition-transform motion-reduce:transition-none " + (showAdvanced ? "rotate-180" : "")} aria-hidden="true" />
            </button>
            {Boolean(search.especialidade !== "Todas" || search.servico || search.uf || search.cidade || search.bairro || search.regiao || search.prioridade || search.municipio_ibge) && (
              <button type="button"
                onClick={() => update({ especialidade: "Todas", servico: "", uf: "", cidade: "", bairro: "", regiao: "", prioridade: "", municipio_ibge: "", pagina: 1 })}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <X className="h-4 w-4" aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>
          <div id="filtros-avancados" role="region" aria-label="Filtros avançados" className={showAdvanced ? "mt-3 grid gap-3 border-t border-border pt-4 sm:grid-cols-3" : "hidden"}>
          <div>
            <label htmlFor="filtro-servico" className="text-xs font-medium text-muted-foreground">Serviço específico</label>
            <select id="filtro-servico" value={services.some((service) => service.slug === search.servico) ? search.servico : ""}
              onChange={(e) => { update({ servico: e.target.value, pagina: 1 }); trackFilter("servico", e.target.value); }}
              disabled={servicesLoading} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Todos os serviços</option>
              {services.filter((service) => specialty === "Todas" || service.category_slug === specialty).map((service) => (
                <option key={service.slug} value={service.slug}>{service.label}</option>
              ))}
            </select>
          </div>
          {search.uf && <div className="sm:col-span-3">
            <label htmlFor="filtro-municipio-ibge" className="text-xs font-medium text-muted-foreground">
              Filtrar por cobertura declarada em município oficial (IBGE)
            </label>
            <select id="filtro-municipio-ibge" value={search.municipio_ibge}
              disabled={officialLoading || officialError}
              onChange={event => {
                const selected = officialCities.find(city => city.id === Number(event.target.value));
                if (selected) update({ municipio_ibge: String(selected.id), uf: selected.uf,
                  cidade: selected.name, bairro: "", regiao: "", prioridade: "", pagina: 1 });
                else update({ municipio_ibge: "", cidade: "", pagina: 1 });
              }} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Manter busca atual por texto</option>
              {officialCities.map(city => <option key={city.id} value={city.id}>{city.name}/{city.uf}</option>)}
            </select>
            {officialError && <p role="alert" className="mt-1 text-xs text-destructive">Municípios oficiais indisponíveis. Use a busca por texto.</p>}
            {search.municipio_ibge && <p className="mt-1 text-xs text-muted-foreground">
              Apenas municípios declarados pelos profissionais, sem inferir distância ou disponibilidade.
              Resultados paginados, sem contagem exaustiva anunciada.
            </p>}
          </div>}
          {!search.municipio_ibge && <DebouncedTextFilter
            key={`filtro-bairro-${search.uf}`}
            id="filtro-bairro"
            label="Bairro"
            list={bairroCatalog ? "eut-bairro-diretorio" : undefined}
            value={search.bairro}
            placeholder="Ex.: Centro"
            onCommit={(value) => update({ bairro: value, pagina: 1 })}
            onBlurTrack={(value) => trackFilter("bairro", value)}
          />}
          {!search.municipio_ibge && bairroCatalog && <div className="text-xs text-muted-foreground sm:col-span-3">
            <datalist id="eut-bairro-diretorio">
              {neighborhoodOptions(bairroCatalog).map(bairro => <option key={bairro} value={bairro} />)}
            </datalist>
            Bairros sugeridos pela <a className="text-primary underline" href={bairroCatalog.sourceUrl}
              target="_blank" rel="noopener noreferrer">prefeitura</a>; você pode digitar outra denominação.
          </div>}
          {!search.municipio_ibge && <DebouncedTextFilter
            key={`filtro-regiao-${search.uf}`}
            id="filtro-regiao"
            label="Região"
            value={search.regiao}
            placeholder="Ex.: Zona Sul"
            onCommit={(value) => update({ regiao: value, pagina: 1 })}
            onBlurTrack={(value) => trackFilter("regiao", value)}
          />}
          <div className="sm:col-span-3">
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox" checked={prioritizeRegion}
              disabled={!hasDeclaredLocation || Boolean(search.municipio_ibge)}
              onChange={(event) => update({ prioridade: event.target.checked ? "regiao" : "", pagina: 1 })}
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
            </div>
          </div>
        </section>
        {suggestedArea && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-accent/50 px-4 py-3 text-sm">
            <span><MapPin className="mr-1 inline h-4 w-4 text-primary" aria-hidden="true" />
              Você pode estar perto de <strong>{suggestedArea.city}/{suggestedArea.uf}</strong>. Estimativa por IP, não localização exata.</span>
            <Link to="/tecnicos" search={{especialidade:search.especialidade,cidade:suggestedArea.city,uf:suggestedArea.uf,bairro:suggestedArea.neighborhood,regiao:"",servico:search.servico,prioridade:"regiao",municipio_ibge:"",pagina:1}}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">Buscar na região <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        )}
        <SponsoredPublicSlot slotKey="search.top" routePath="/tecnicos" />
        <div aria-live="polite" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-brand-navy via-[#173d61] to-brand-navy px-5 py-4 text-brand-navy-foreground shadow-sm">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-brand-glow">
              <UserRoundCheck className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-white">{technicians.length} {technicians.length === 1 ? "profissional" : "profissionais"} {search.municipio_ibge ? "nesta página" : "nesta busca"}</h2>
              <p className="text-xs text-white/80">{searchArea || "Em todo o Brasil"} · Perfis públicos declarados</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/85"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Contatos protegidos</span>
        </div>
        <div className="mt-4">
          {technicians.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                title={search.municipio_ibge ? "Nenhum técnico elegível nesta página" : "Nenhum técnico encontrado com estes filtros"}
                description={search.municipio_ibge ? "Esta página não confirma a ausência de técnicos em todo o município. Outros registros podem estar nas próximas páginas após a verificação de elegibilidade. Nenhum cadastro antigo em revisão é apresentado como ativo." : "Ainda não encontramos um profissional com perfil ativo para esta pesquisa. Você pode registrar sua necessidade ou, se é profissional, criar seu perfil no portal novo. Cadastros antigos em conferência não são apresentados como técnicos disponíveis."}
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
            <ul className="grid gap-4 md:grid-cols-2 lg:gap-5">
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
        {search.municipio_ibge && <nav aria-label="Paginação dos técnicos por município" className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={search.pagina <= 1} onClick={() => update({ pagina: search.pagina - 1 })}
            className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">Anterior</button>
          <span className="text-sm text-muted-foreground">Página {search.pagina}</span>
          <button type="button" disabled={!hasMore || search.pagina >= 20} onClick={() => update({ pagina: search.pagina + 1 })}
            className="min-h-11 rounded-lg border border-input px-4 text-sm disabled:opacity-40">Consultar próxima página</button>
          <p className="w-full text-xs text-muted-foreground">Até 50 perfis elegíveis por página. Próxima página somente quando confirmada; após 20 páginas, refine os filtros. Não há total municipal presumido.</p>
        </nav>}
        {CATEGORY_SEARCH_CONTEXT[search.especialidade] && (
          <aside aria-label="Orientações da especialidade selecionada"
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-bold text-foreground">{CATEGORY_SEARCH_CONTEXT[search.especialidade]?.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {CATEGORY_SEARCH_CONTEXT[search.especialidade]?.advice}
              </p>
            </div>
            <Link to="/servicos/$categoria" params={{ categoria: search.especialidade }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary/10">
              Ver informações e profissionais desta categoria →
            </Link>
          </aside>
        )}
        <section aria-label="Transparência e confiança na busca" className="mt-6 grid gap-3 rounded-2xl border border-primary/15 bg-accent/50 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-3"><UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-foreground"><strong className="block">{technicians.length} perfil{technicians.length === 1 ? "" : "s"} {search.municipio_ibge ? "nesta página" : "nesta busca"}</strong><span className="text-xs text-muted-foreground">Somente perfis publicados; resultados conforme os filtros aplicados.</span></p></div>
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-foreground"><strong className="block">Localidade informada</strong><span className="text-xs text-muted-foreground">Regiões declaradas pelos profissionais, sem localização inventada.</span></p></div>
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-sm text-foreground"><strong className="block">Contato protegido</strong><span className="text-xs text-muted-foreground">Telefones particulares não aparecem na busca pública.</span></p></div>
        </section>
         {!search.municipio_ibge && canShowLegacyArchive(search) && (
           <LegacyPublicArchive show={canShowLegacyArchive(search)} />
         )}
      </section>
    </PageShell>
  );
}
