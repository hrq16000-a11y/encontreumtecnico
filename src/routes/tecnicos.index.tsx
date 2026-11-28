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
import { SearchableChoice } from "@/components/ui/searchable-choice";
import { SearchMunicipalityChoice } from "@/components/search-municipality-choice";
import { clearDirectoryPendingFilters } from "@/lib/pending-search-filter";
import { BRAZIL_STATES, BRAZIL_STATE_NAMES } from "@/lib/service-taxonomy";
import { technicianSearchAfterUfChange } from "@/lib/technician-search-uf-transition";
import { directoryServiceChoices } from "@/lib/technician-directory-service-choices";
import { neighborhoodCatalogFor, neighborhoodOptions } from "@/lib/neighborhood-sources";
import { groupTechniciansByDeclaredArea, localMatchLabel } from "@/lib/technician-local-ranking";
import { LegacyPublicArchive } from "../components/legacy-public-archive";
import { canShowLegacyArchive } from "../lib/legacy-archive-filters";
import { useEffect, useRef, useState } from "react";
import { analyticsAllowed, recordSearch } from "@/lib/search-analytics";
import { openFreeHelp } from "@/lib/free-search-help";
import { ChevronDown, ListFilter, Search, ShieldCheck, SlidersHorizontal, UserRoundCheck, LifeBuoy, X } from "lucide-react";

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
  pagina: fallback(z.coerce.number().int().min(1).max(1000), 1).default(1),
});

export const Route = createFileRoute("/tecnicos/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listApprovedTechnicians({ data: deps }),
  head: () => ({
    meta: [
      { title: "Técnicos de CFTV e informática por cidade — Encontre um Técnico" },
      { name: "description", content: "Procurando técnico perto de mim? Consulte profissionais de informática, CFTV e redes com prioridade à região aproximada, quando disponível. Filtre por cidade, UF ou serviço." },
      { property: "og:title", content: "Técnicos de CFTV e informática por cidade — Encontre um Técnico" },
      { property: "og:description", content: "Encontre técnicos por especialidade e cidade. Resultados regionais são priorizados quando há uma referência aproximada disponível." },
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
  const { categories, loading: catalogLoading, error: catalogError } = useActiveCategories();
  const { services, loading: servicesLoading, error: servicesError } = useActiveServices();
  const technicians = Route.useLoaderData();
  const navigate = useNavigate({ from: "/tecnicos/" });
  const lastRecorded = useRef("");
  const [consentRevision, setConsentRevision] = useState(0);
  const [filterResetRevision, setFilterResetRevision] = useState(0);
  // Keep advanced controls mounted to preserve debounced drafts while collapsed.
  const [showAdvanced, setShowAdvanced] = useState(
    () => Boolean(search.servico || search.bairro || search.regiao || search.prioridade === "regiao"),
  );
  useEffect(() => {
    if (search.servico || search.bairro || search.regiao || search.prioridade === "regiao") {
      setShowAdvanced(true);
    }
  }, [search.servico, search.bairro, search.regiao, search.prioridade]);
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
  const regionalGroups = prioritizeRegion
    ? groupTechniciansByDeclaredArea(technicians, { uf: search.uf, cidade: search.cidade, bairro: search.bairro })
    : null;
  const localCount = regionalGroups?.local.length ?? technicians.length;
  const alternativesCount = regionalGroups ? regionalGroups.sameState.length + regionalGroups.otherStates.length : 0;

  const searchArea = [search.bairro, search.cidade, search.uf].filter(Boolean).join(" · ");
  const bairroCatalog = neighborhoodCatalogFor({ city: search.cidade, uf: search.uf });
  const helpContext = { city: search.cidade, uf: search.uf, neighborhood: search.bairro,
    service: services.find((s) => s.slug === search.servico)?.label || search.servico || (search.especialidade !== "Todas" ? categoryLabel(search.especialidade, categories) : ""), placement: "directory-results" };

  useEffect(() => {
    if (technicians.length > 0 || !searchArea || search.pagina > 1) return;
    // One contextual invitation per browser tab; never nag on every filter.
    const popup = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem("eut-free-help-invite") === "seen") return;
        sessionStorage.setItem("eut-free-help-invite", "seen");
      } catch { /* Session storage unavailable: the button remains available. */ }
      openFreeHelp({ ...helpContext, placement: "directory-empty" });
    }, 850);
    return () => window.clearTimeout(popup);
  }, [technicians.length, searchArea, search.cidade, search.uf, search.bairro, search.servico, search.pagina]);

  const specialty = categories.some((c) => c.slug === search.especialidade)
    ? search.especialidade
    : "Todas";
  const directoryServiceOptions = directoryServiceChoices(services, categories, specialty, "", search.servico);

  const update = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, pagina: patch.pagina ?? 1 }), replace: true });

  const clearAllFilters = () => {
    // Cancel pending same-tab drafts before remounting the debounced fields.
    // Otherwise a stale keystroke may repopulate a cleared search.
    clearDirectoryPendingFilters();
    setFilterResetRevision(value => value + 1);
    update({ especialidade: "Todas", servico: "", uf: "", cidade: "", bairro: "", regiao: "", prioridade: "" });
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:pt-8">
        <div className="relative isolate overflow-hidden rounded-[28px] border border-brand-glow/20 bg-gradient-to-br from-brand-navy via-[#173d61] to-brand-navy px-5 py-7 text-brand-navy-foreground shadow-soft sm:px-8 sm:py-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-32 h-72 w-72 rounded-full bg-brand-glow/15 blur-3xl" />
          <span className="relative inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-brand-glow"><ListFilter className="h-4 w-4" aria-hidden="true" /> Diretório de profissionais</span>
          <h1 className="relative mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Encontre técnicos na sua região</h1>
          <p className="relative mt-3 max-w-2xl text-sm leading-6 text-white/85">
            Encontre técnicos por serviço, especialidade e cidade, com resultados organizados para facilitar sua escolha.
          </p>
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90">
            <ShieldCheck className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Contatos particulares continuam protegidos
          </div>
        </div>

        <section aria-label="Filtros da busca" className="relative z-10 mt-5 rounded-2xl border border-primary/20 bg-card p-4 shadow-soft sm:p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-card-foreground">
            <Search className="h-5 w-5 text-primary" aria-hidden="true" /> Encontre um profissional
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="filtro-especialidade" className="text-xs font-medium text-muted-foreground">
              Especialidade
            </label>
            <SearchableChoice
              id="filtro-especialidade"
              value={specialty}
              options={[{value: "Todas", label: "Todas as categorias"}, ...categories.map(c => ({value: c.slug, label: c.label, keywords: c.description}))]}
              clearOnEdit={false}
              placeholder="Digite a especialidade"
              onChange={(value) => {
                update({ especialidade: value, servico: "" });
                trackFilter("especialidade", value);
              }}
              className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            {catalogLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Carregando especialidades…</p>}
            {catalogError && <p role="alert" className="mt-1 text-sm text-destructive">Não foi possível carregar as especialidades. Você pode buscar por cidade.</p>}
          </div>
          <div>
            <label htmlFor="filtro-uf" className="text-xs font-medium text-muted-foreground">Estado (UF)</label>
            <SearchableChoice id="filtro-uf" value={search.uf} clearOnEdit={false}
              options={[{value: "", label: "Todos os estados"}, ...BRAZIL_STATES.map(uf => ({value: uf, label: `${BRAZIL_STATE_NAMES[uf]} (${uf})`, displayLabel: uf}))]}
              onChange={(value) => { if (value !== search.uf) update(technicianSearchAfterUfChange(value, search.prioridade)); trackFilter("uf", value); }}
              className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <SearchMunicipalityChoice
            key={`filtro-cidade-${search.uf}-${filterResetRevision}`}
            id="filtro-cidade"
            uf={search.uf} city={search.cidade}
            onChange={(cidade, uf) => { update({ cidade, uf, bairro: "", regiao: "" }); trackFilter("cidade", cidade); }}
          />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <button type="button" aria-expanded={showAdvanced} aria-controls="filtros-avancados"
              onClick={() => setShowAdvanced(value => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-accent/60 px-4 text-sm font-bold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Mais filtros
              {[search.servico, search.bairro, search.regiao, prioritizeRegion ? "regiao" : ""].filter(Boolean).length > 0 &&
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {[search.servico, search.bairro, search.regiao, prioritizeRegion ? "regiao" : ""].filter(Boolean).length}
                </span>}
              <ChevronDown className={"h-4 w-4 transition-transform motion-reduce:transition-none " + (showAdvanced ? "rotate-180" : "")} aria-hidden="true" />
            </button>
            {Boolean(search.especialidade !== "Todas" || search.servico || search.uf || search.cidade || search.bairro || search.regiao || search.prioridade) && (
              <button type="button"
                onClick={clearAllFilters}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <X className="h-4 w-4" aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>
          <div id="filtros-avancados" role="region" aria-label="Filtros avançados" className={showAdvanced ? "mt-3 grid gap-3 border-t border-border pt-4 sm:grid-cols-3" : "hidden"}>
          <div>
            <label htmlFor="filtro-servico" className="block text-xs font-medium text-muted-foreground">Serviço específico</label>
            <SearchableChoice id="filtro-servico" value={search.servico} clearOnEdit={false}
              options={[{value: "", label: "Todos os serviços"}, ...directoryServiceOptions.map(service => ({value: service.slug, label: service.label, detail: categoryLabel(service.category_slug, categories)}))]}
              placeholder="Ex.: instalação, Wi-Fi, computadores"
              onChange={(value) => { update({ servico: value }); trackFilter("servico", value); }}
              className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring" />
            {servicesLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Carregando serviços…</p>}
            {servicesError && <p role="alert" className="mt-1 text-sm text-destructive">Lista de serviços indisponível. A busca por especialidade continua disponível.</p>}
          </div>
          <DebouncedTextFilter
            key={`filtro-bairro-${search.uf}-${filterResetRevision}`}
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
            key={`filtro-regiao-${search.uf}-${filterResetRevision}`}
            id="filtro-regiao"
            label="Região"
            value={search.regiao}
            placeholder="Ex.: Zona Sul"
            onCommit={(value) => update({ regiao: value })}
            onBlurTrack={(value) => trackFilter("regiao", value)}
          />
            <div className="sm:col-span-3">
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
              <span className="mt-1 block text-xs text-muted-foreground">Exibe primeiro as áreas informadas e mantém alternativas de outras regiões.</span>
            </span>
          </label>
          {!hasDeclaredLocation && (
            <p className="text-xs text-muted-foreground">Informe o estado (UF) ou município para ativar.</p>
          )}
        </div>
            </div>
          </div>
        </section>
        <SponsoredPublicSlot slotKey="search.top" routePath="/tecnicos" />
        <div aria-live="polite" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-brand-navy via-[#173d61] to-brand-navy px-5 py-4 text-brand-navy-foreground shadow-sm">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-brand-glow">
              <UserRoundCheck className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-white">{localCount} {localCount === 1 ? "profissional" : "profissionais"} {regionalGroups ? "com atendimento local declarado nesta página" : "nesta página"}</h2>
              <p className="text-xs text-white/80">{searchArea || "Em todo o Brasil"} · {regionalGroups ? `${alternativesCount} ${alternativesCount === 1 ? "alternativa de outra localidade" : "alternativas de outras localidades"} em seções separadas` : "Perfis públicos declarados"}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          {(() => {
            // Keep actual cards in the results area, before contextual guidance.
            const renderCards = (rows: typeof technicians) => (
              <ul className="grid min-w-0 gap-4 md:grid-cols-2 lg:gap-5">
                {rows.map((t) => (
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
            );
            return technicians.length === 0 ? (
              search.pagina > 1 ? (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
                  <h2 className="text-lg font-bold text-foreground">Esta página da busca não tem resultados</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Pode haver técnicos nas páginas anteriores. Volte à primeira página mantendo os filtros da pesquisa.
                  </p>
                  <button type="button" onClick={() => void update({ pagina: 1 })}
                    className="mt-4 min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    Voltar à primeira página
                  </button>
                </div>
              ) : (
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
              )
          ) : regionalGroups ? (
            <div className="space-y-7">
              <section aria-label="Atendimento declarado na localidade pesquisada" className="space-y-3">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">Atendimento declarado {search.cidade.trim() ? `em ${search.cidade}${search.uf ? `/${search.uf}` : ""}` : `no estado ${search.uf}`}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{localCount} {localCount === 1 ? "perfil informa" : "perfis informam"} atender a esta localidade; isso não garante disponibilidade.</p>
                </div>
                {regionalGroups.local.length > 0 ? renderCards(regionalGroups.local) : (
                  <div role="status" className="rounded-2xl border border-primary/25 bg-accent/50 p-5 sm:p-6">
                    <h3 className="text-base font-bold text-foreground">Ainda não há técnico com atendimento declarado {search.cidade.trim() ? "nesta cidade" : "neste estado"}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">As opções abaixo são de outras localidades. Elas não devem ser confundidas com atendimento confirmado na região pesquisada.</p>
                    <button type="button" onClick={() => openFreeHelp(helpContext)}
                      className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                      <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Pedir ajuda para minha região
                    </button>
                  </div>
                )}
              </section>
              {regionalGroups.sameState.length > 0 && (
                <section aria-label="Alternativas de outros municípios do estado" className="space-y-3 border-t border-border pt-6">
                  <h2 className="text-lg font-extrabold text-foreground">Outras cidades de {search.uf}</h2>
                  <p className="text-sm text-muted-foreground">Esses profissionais estão no mesmo estado, mas não declararam atendimento à cidade pesquisada.</p>
                  {renderCards(regionalGroups.sameState)}
                </section>
              )}
              {regionalGroups.otherStates.length > 0 && (
                <section aria-label="Sugestões nacionais de outras localidades" className="space-y-3 border-t border-border pt-6">
                  <h2 className="text-lg font-extrabold text-foreground">{search.uf ? "Sugestões de outros estados" : "Sugestões de outras regiões"}</h2>
                  <p className="text-sm text-muted-foreground">Esses perfis não declaram atender à localidade pesquisada. Confirme a área de cobertura antes de solicitar atendimento.</p>
                  {renderCards(regionalGroups.otherStates)}
                </section>
              )}
            </div>
          ) : renderCards(technicians);
          })()}
        </div>
        <nav aria-label="Paginação do diretório" className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {search.pagina > 1 && <button type="button" onClick={() => void update({ pagina: search.pagina - 1 })}
            className="min-h-11 rounded-xl border border-primary/40 px-4 text-sm font-bold text-primary">Página anterior</button>}
          <span className="text-sm text-muted-foreground">Página {search.pagina}</span>
          {technicians.length >= 100 && search.pagina < 1000 && <button type="button" onClick={() => void update({ pagina: search.pagina + 1 })}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Próxima página</button>}
        </nav>
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
<p className="mx-auto my-5 w-full max-w-6xl px-4 text-sm leading-7 text-muted-foreground">Em dúvida sobre qual especialidade escolher? Os <a href="/guias" className="font-semibold text-primary underline underline-offset-2">guias de diagnóstico</a> ajudam a descrever o problema. Se precisar de atendimento presencial, consulte a <a href="/cobertura" className="font-semibold text-primary underline underline-offset-2">cobertura da rede</a> e confirme com o técnico se há taxa de visita.</p>
        <LegacyPublicArchive show={canShowLegacyArchive(search)} />
      </section>
    </PageShell>
  );
}
