import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, HandCoins, Eye, Scale, Camera, Laptop, Wifi, Printer, MapPin, Search, ArrowRight, Wrench, UsersRound } from "lucide-react";
import logo from "@/assets/logo-encontreumtecnico.png.asset.json";
import heroImg from "@/assets/tecnico-cftv-instalacao.jpg";
import techImg from "@/assets/tecnica-informatica.jpg";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { AdSensePublicUnit } from "@/components/adsense-public-unit";
import { HomePublicProof } from "@/components/home-public-proof";
import { HomeCommunityInvite } from "@/components/home-community-invite";
import { HomeTechnicianJoin } from "@/components/home-technician-join";
import { ProblemAssistant } from "../components/problem-assistant";
import { safeNeighborhood } from "@/lib/location-labels";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { readUiTextDraft, saveUiTextDraft } from "@/lib/unsent-ui-draft";
import { SearchableChoice } from "@/components/ui/searchable-choice";
import { SearchMunicipalityChoice } from "@/components/search-municipality-choice";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { BRAZIL_STATES, BRAZIL_STATE_NAMES } from "@/lib/service-taxonomy";
import { analyticsAllowed } from "@/lib/search-analytics";
import {
  CategoryGrid,
  HowItWorksRich,
  CoverageSection,
  ApprovalProcessSection,
  FaqPreview,
  ContactBand,
} from "../components/home-rich";
import { CanaisDeAtendimento, FindOneSection, JoinNetworkSection, CtaBand, ValuesSection, StepsSection } from "../components/home-sections";

const SITE = "https://www.encontreumtecnico.com.br";
const TITLE = "Encontre um Técnico — CFTV e informática em todo o Brasil";
const DESC = "Portal brasileiro que conecta clientes a técnicos de CFTV, informática, redes e impressoras com transparência: cadastro livre, sem cobrança ao profissional e sem leilão de preço.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE + "/" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "Encontre um Técnico" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: SITE + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Encontre um Técnico",
              legalName: "Ping Soluções",
              url: SITE,
              logo: new URL(logo.url, SITE).href,
              areaServed: "BR",
              description: DESC,
              slogan: "Precisou? Encontrou!",
            },
            {
              "@type": "WebSite",
              name: "Encontre um Técnico",
              url: SITE,
              inLanguage: "pt-BR",
              potentialAction: {
                "@type": "SearchAction",
                target: SITE + "/tecnicos?especialidade={especialidade}",
                "query-input": "required name=especialidade",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: HomePage,
});

const TRUST = [
  { icon: Eye, title: "Cadastro livre", text: "Profissionais informam seus serviços; a plataforma não certifica a capacidade técnica." },
  { icon: HandCoins, title: "Sem custo para o profissional", text: "O técnico não paga para estar na rede nem por contato." },
  { icon: Eye, title: "Transparência", text: "Especialidades, cidade e status claros em cada perfil." },
  { icon: Scale, title: "Valorização do técnico", text: "Sem leilão de preço: o profissional define seu trabalho." },
];

const CHIPS = [
  { i: Camera, t: "CFTV", value: "cftv" },
  { i: Laptop, t: "Informática", value: "computadores" },
  { i: Wifi, t: "Redes", value: "redes" },
  { i: Printer, t: "Impressoras", value: "impressoras" },
];


/** Artworks already versioned in the portal. Keep the two existing Home photos. */
const HOME_VISUALS = [
  { slug: "cftv", title: "Câmeras e segurança", subtitle: "Planeje a instalação de câmeras e gravadores.",
    src: "/guias/cftv-planejamento-ilustrado.svg", alt: "Ilustração de câmeras e gravador de segurança em uma casa." },
  { slug: "computadores", title: "Computadores e notebooks", subtitle: "Encontre ajuda para diagnóstico e manutenção.",
    src: "/guias/computador-diagnostico-ilustrado.svg", alt: "Ilustração de uma bancada de diagnóstico com notebook e ferramentas." },
  { slug: "redes", title: "Wi-Fi e redes", subtitle: "Confira soluções para conexão e cobertura de sinal.",
    src: "/guias/wifi-instabilidade-cobertura-ilustrado.svg", alt: "Ilustração de uma casa com roteador e cobertura Wi-Fi nos ambientes." },
  { slug: "impressoras", title: "Impressoras", subtitle: "Resolva problemas de conexão, fila e impressão.",
    src: "/guias/impressora-offline-fila-ilustrado.svg", alt: "Ilustração de uma impressora com fila de impressão e conectividade." },
] as const;

function HomePage() {
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading, error: categoriesError } = useActiveCategories();
  // Initial SSR and client render agree; the saved search is loaded only
  // after hydration, while the empty form stays hidden from the visitor.
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [locationUf, setLocationUf] = useState("");
  const [locationNeighborhood, setLocationNeighborhood] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const cityEditedByUser = useRef(false);
  useEffect(() => {
    const saved = readUiTextDraft("home");
    if (saved) {
      setSpecialty(saved["specialty"] ?? "");
      setCity(saved["city"] ?? "");
      setLocationUf(saved["uf"] ?? "");
      setLocationNeighborhood(safeNeighborhood(saved["neighborhood"] ?? "", saved["city"] ?? ""));
      cityEditedByUser.current = Boolean(saved["city"]);
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    saveUiTextDraft("home", { specialty, city, uf: locationUf, neighborhood: locationNeighborhood });
  }, [draftReady, specialty, city, locationUf, locationNeighborhood]);
  const { area: suggestedRegion } = useRegionalSuggestion();
  useEffect(() => {
    // The user may edit while the lookup is pending; never override typed city.
    if (!draftReady || !suggestedRegion || city.trim() || cityEditedByUser.current) return;
    setCity(suggestedRegion.city);
    setLocationUf(suggestedRegion.uf);
    setLocationNeighborhood(""); // IP cannot establish a neighborhood.
  }, [draftReady, suggestedRegion?.city, suggestedRegion?.uf, city]);


  return (
    <PageShell>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy via-[#124b76] to-brand-navy px-4 pb-10 pt-8 sm:py-14 lg:py-16">
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.16fr_0.84fr] lg:gap-12">
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-wide text-brand-glow">
              <span aria-hidden="true" className="h-px w-6 shrink-0 bg-brand-glow" />
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> Portal nacional · sem custo para o profissional
            </p>
            <h1 className="mt-4 text-[2.65rem] font-extrabold leading-[1.02] tracking-tight text-white sm:text-6xl">
              Precisou? <span className="block text-brand-glow">Encontrou!</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              Encontre prestadores cadastrados de CFTV, informática, redes e impressoras na sua região. Negocie diretamente, sem leilão de menor preço.
            </p>
            <div className="mt-6 rounded-3xl border border-white/15 bg-card p-4 shadow-soft sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Busca por especialidade e região</p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight text-card-foreground">Encontre o técnico certo.</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              {!draftReady ? (
                <div role="status" aria-live="polite" aria-busy="true"
                  className="mt-4 grid min-h-28 content-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  Recuperando sua busca…
                  <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }} className="w-fit font-semibold text-primary underline underline-offset-4">Abrir diretório de técnicos</Link>
                </div>
              ) : (
                <form className="mt-4 grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (analyticsAllowed(localStorage.getItem("eut-cookie-consent"))) window.__lovableEvents?.track?.("project.technician_search", {
                      has_specialty: specialty.trim() !== "",
                      has_city: city.trim() !== "",
                    });
                    navigate({
                      to: "/tecnicos",
                      search: { especialidade: specialty.trim() || "Todas", cidade: city.trim(), regiao: "",
                        uf: locationUf, bairro: locationNeighborhood, prioridade: locationUf ? "regiao" : "" },
                    });
                  }}
                >
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-xs font-bold text-card-foreground" htmlFor="busca-especialidade"><span aria-hidden="true" className="mr-1.5 font-mono text-primary">01</span>Especialidade</label>
                      <SearchableChoice
                        id="busca-especialidade"
                        value={specialty}
                        options={[{ value: "", label: "Todas as especialidades" }, ...categories.map(item => ({value: item.slug, label: item.label, keywords: item.description}))]}
                        clearOnEdit={false}
                        onChange={(value) => { saveUiTextDraft("home", { specialty:value, city, uf:locationUf, neighborhood:locationNeighborhood }); setSpecialty(value); }}
                        placeholder="Digite a especialidade"
                        className="h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {categoriesLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Carregando especialidades…</p>}
                      {categoriesError && <p role="alert" className="mt-1 text-sm text-destructive">Especialidades indisponíveis; busque por cidade.</p>}
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1.5 block text-xs font-bold text-card-foreground" htmlFor="busca-uf">Estado (UF)</label>
                      <SearchableChoice id="busca-uf" value={locationUf} clearOnEdit={false}
                        options={[{value: "", label: "Todos os estados"}, ...BRAZIL_STATES.map(uf => ({value: uf, label: `${BRAZIL_STATE_NAMES[uf]} (${uf})`, displayLabel: uf}))]}
                        onChange={uf => { if (uf === locationUf) return; cityEditedByUser.current = true; setLocationUf(uf); setCity(""); setLocationNeighborhood(""); saveUiTextDraft("home", {specialty, city:"", uf, neighborhood:""}); }}
                        className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring" />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <SearchMunicipalityChoice
                        id="busca-cidade"
                        uf={locationUf} city={city}
                        onChange={(cidade, uf) => { cityEditedByUser.current = true; setCity(cidade); setLocationUf(uf); setLocationNeighborhood(""); saveUiTextDraft("home", {specialty, city:cidade, uf, neighborhood:""}); }} />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="group flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  >
                    <span className="flex items-center gap-2"><Search className="h-4 w-4" aria-hidden="true" /> Buscar</span>
                    <ArrowRight className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
                  </button>
                  <div role="group" aria-label="Sugestões de especialidades" className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">Sugestões:</span>
                    {CHIPS.map(({ i: I, t, value }) => (
                      <button key={t} type="button" aria-pressed={specialty === value}
                        onClick={() => { saveUiTextDraft("home", { specialty:value, city, uf:locationUf, neighborhood:locationNeighborhood }); setSpecialty(value); }}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors duration-150 hover:border-primary/50 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">
                        <I className="h-4 w-4 text-primary" aria-hidden="true" /> {t}
                      </button>
                    ))}
                  </div>
                </form>
              )}
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-2 text-sm text-white/80">
              É técnico? <Link to="/cadastro" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-glow underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Cadastre-se gratuitamente <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </p>
          </div>
          <figure className="min-w-0 overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-2 sm:p-3">
            <img src={heroImg} alt="Técnico instalando câmera de segurança na fachada de uma casa" width={1280} height={1024} className="aspect-[5/4] w-full rounded-[18px] object-cover" />
            <figcaption className="flex items-center gap-3 px-3 py-4 text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-glow"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 text-sm"><span className="block font-semibold">Técnicos perto de você</span><span className="block text-white/75">Busque por cidade ou região</span></span>
            </figcaption>
          </figure>
        </div>
      </section>

      <HomeTechnicianJoin />

      <section aria-labelledby="home-expansao-rede" className="border-b border-primary/15 bg-primary/5 px-4 py-8 sm:py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Expansão nacional · profissionais procurados</p>
            <h2 id="home-expansao-rede" className="mt-2 text-xl font-extrabold text-foreground sm:text-2xl">
              Buscamos técnicos no Sul, em SP, RJ e outras cidades
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Conheça as regiões da chamada de recrutamento. A lista não representa
              disponibilidade confirmada nem quantidade de pedidos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/cobertura#expansao-da-rede" className="inline-flex min-h-11 items-center rounded-xl border border-primary/30 bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-accent">
              Ver localidades procuradas
            </a>
            <Link to="/cadastro" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Cadastrar como técnico
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="home-visual-servicos" className="border-b border-border bg-background px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Explore visualmente</p>
            <h2 id="home-visual-servicos" className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Seu problema, nossa próxima conexão</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Explore quatro especialidades e encontre profissionais por serviço e localidade.
            </p>
          </div>
          <Link to="/servicos" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-accent">
            Ver todos os serviços <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_VISUALS.map((item) => (
            <li key={item.slug}>
              <Link to="/servicos/$categoria" params={{ categoria: item.slug }}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none">
                <div className="overflow-hidden bg-brand-navy/10">
                  <img src={item.src} alt={item.alt} width={1200} height={630} loading="lazy" decoding="async"
                    className="aspect-[40/21] w-full object-cover transition-transform duration-150 group-hover:scale-[1.015] motion-reduce:transform-none motion-reduce:transition-none" />
                </div>
                <div className="flex flex-1 items-center justify-between gap-3 p-5">
                  <div>
                    <h3 className="font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
        </div>
      </section>

      <CanaisDeAtendimento />

      <section aria-label="Por que o Encontre um Técnico" className="bg-brand-navy px-4 py-12 text-brand-navy-foreground">
        <ul className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: I, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-glow/15 text-brand-glow"><I className="h-5 w-5" aria-hidden /></span>
              <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm opacity-80">{text}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <SponsoredPublicSlot slotKey="home.content_1" routePath="/" />

      <CategoryGrid />

      <HomePublicProof />




      <section className="mx-auto max-w-3xl px-4 pb-16">
        <ProblemAssistant />
      </section>

      <HowItWorksRich />

<p className="mx-auto my-5 w-full max-w-6xl px-4 text-sm leading-7 text-muted-foreground">Precisa de uma visita? Consulte a <a href="/cobertura" className="font-semibold text-primary underline underline-offset-2">cobertura por município</a> e use o <a href="/servicos" className="font-semibold text-primary underline underline-offset-2">catálogo de serviços</a> para identificar a especialidade antes de escolher um profissional.</p>
      <AdSensePublicUnit />

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
        <img src={techImg} alt="Técnica de informática fazendo manutenção em computador e roteador" width={1280} height={960} loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-soft" />
        <div>
          <h2 className="text-3xl font-bold text-foreground">Aqui o profissional é valorizado</h2>
          <p className="mt-4 text-muted-foreground">
            Não cobramos do técnico para participar nem por cliente recebido, e não fazemos leilão de preço. O cliente encontra quem tem a especialidade certa, perto dele, e o técnico é reconhecido pelo seu trabalho.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/cadastro" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Wrench className="h-4 w-4" aria-hidden="true" /> Sou técnico, quero participar</Link>
            <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:border-primary"><Search className="h-4 w-4" aria-hidden /> Ver técnicos</Link>
          </div>
        </div>
      </section>

      <HomeCommunityInvite />

      <CoverageSection />
      <ApprovalProcessSection />

      <FindOneSection />
      <JoinNetworkSection />
      <CtaBand />
      <ValuesSection />
      <StepsSection />

      <FaqPreview />
      <ContactBand />

      <section aria-labelledby="home-journeys-title" className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 max-w-2xl">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary">A jornada é sua</span>
            <h2 id="home-journeys-title" className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Como você quer começar?
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
              Encontre ajuda para um serviço ou apresente seu trabalho à rede. Escolha seu caminho.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <article className="eut-card-lift group relative isolate flex min-h-80 flex-col overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-card via-card to-accent/70 p-6 shadow-soft sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 text-primary/10">
                <UsersRound className="h-56 w-56" strokeWidth={0.8} />
              </div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                <UsersRound className="h-8 w-8" aria-hidden="true" />
              </div>
              <div className="relative mt-6 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-widest text-primary">Quero resolver</p>
                <h3 className="mt-2 text-2xl font-extrabold text-card-foreground">Sou Cliente</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                  Cadastre-se, encontre profissionais por região e especialidade e combine diretamente o serviço.
                </p>
              </div>
              <Link to="/entrar"
                className="relative mt-6 inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-shadow duration-150 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">
                <Search className="h-5 w-5" aria-hidden="true" /> Criar conta de cliente
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
            </article>
            <article className="eut-card-lift group relative isolate flex min-h-80 flex-col overflow-hidden rounded-[28px] border border-brand-glow/30 bg-gradient-to-br from-brand-navy via-[#173e64] to-brand-navy p-6 text-brand-navy-foreground shadow-[0_20px_55px_-25px_rgba(5,20,44,.55)] sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 text-white/10">
                <Wrench className="h-56 w-56" strokeWidth={0.8} />
              </div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-glow/30 bg-white/10 text-brand-glow">
                <Wrench className="h-8 w-8" aria-hidden="true" />
              </div>
              <div className="relative mt-6 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-widest text-brand-glow">Quero participar</p>
                <h3 className="mt-2 text-2xl font-extrabold text-white">Sou Técnico</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-white/85">
                  Mostre suas especialidades, informe sua região de atendimento e participe gratuitamente da rede.
                </p>
              </div>
              <Link to="/cadastro"
                className="relative mt-6 inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded-xl border border-white/30 bg-white px-5 py-3 text-sm font-bold text-brand-navy shadow-sm transition-shadow duration-150 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none">
                <Wrench className="h-5 w-5" aria-hidden="true" /> Criar conta de técnico
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
