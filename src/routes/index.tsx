import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, HandCoins, Eye, Scale, Camera, Laptop, Wifi, Printer, MapPin, Search, ArrowRight, Wrench, UsersRound } from "lucide-react";
import logo from "@/assets/logo-encontreumtecnico.png.asset.json";
import heroImg from "@/assets/tecnico-cftv-instalacao.jpg";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { AdSensePublicUnit } from "@/components/adsense-public-unit";
import { HomePublicProof } from "@/components/home-public-proof";
import { HomeCommunityInvite } from "@/components/home-community-invite";
import { HomeTechnicianJoin } from "@/components/home-technician-join";
import { HomeCategoryPicker, canonicalHomeCategory } from "@/components/home-category-picker";
import { ProblemAssistant } from "../components/problem-assistant";
import { safeNeighborhood } from "@/lib/location-labels";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { useMunicipalities } from "@/hooks/use-municipalities";
import { HomeMunicipalitySearch, homeLocationFilters, parseHomeCityId } from "@/components/home-municipality-search";
import { readUiTextDraft, saveUiTextDraft } from "@/lib/unsent-ui-draft";
import {
  HowItWorksRich,
  CoverageSection,
  FaqPreview,
  ContactBand,
} from "../components/home-rich";
import { CanaisDeAtendimento } from "../components/home-sections";

const SITE = "https://www.encontreumtecnico.com.br";
const TITLE = "Encontre um Técnico — Portal nacional de técnicos de CFTV e informática, sem custo para o profissional";
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
  { i: Camera, t: "CFTV" },
  { i: Laptop, t: "Informática" },
  { i: Wifi, t: "Redes" },
  { i: Printer, t: "Impressoras" },
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
  const { categories: activeCategories, loading: categoriesLoading, error: categoriesError } = useActiveCategories();
  // Initial SSR and client render agree; the saved search is loaded only
  // after hydration, while the empty form stays hidden from the visitor.
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [locationUf, setLocationUf] = useState("");
  const [locationNeighborhood, setLocationNeighborhood] = useState("");
  const [cityIbgeId, setCityIbgeId] = useState<number | null>(null);
  const [citySelectionError, setCitySelectionError] = useState(false);
  const { cities: officialCities, loading: citiesLoading, error: citiesError, retry: retryCities } = useMunicipalities(locationUf);
  const [draftReady, setDraftReady] = useState(false);
  const cityEditedByUser = useRef(false);
  useEffect(() => {
    const saved = readUiTextDraft("home");
    if (saved) {
      setSpecialty(saved["specialty"] ?? "");
      setCity(saved["city"] ?? "");
      setLocationUf(saved["uf"] ?? "");
      setCityIbgeId(parseHomeCityId(saved["cityid"]));
      setLocationNeighborhood(safeNeighborhood(saved["neighborhood"] ?? "", saved["city"] ?? ""));
      cityEditedByUser.current = Boolean(saved["city"]);
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    saveUiTextDraft("home", { specialty, city, uf: locationUf, neighborhood: locationNeighborhood,
      cityid: cityIbgeId === null ? "" : String(cityIbgeId) });
  }, [draftReady, specialty, city, locationUf, locationNeighborhood, cityIbgeId]);
  const { area: suggestedRegion } = useRegionalSuggestion();
  useEffect(() => {
    // The user may edit while the lookup is pending; never override typed city.
    if (!draftReady || !suggestedRegion || city.trim() || cityEditedByUser.current) return;
    setCity(suggestedRegion.city);
    setLocationUf(suggestedRegion.uf);
    setCityIbgeId(null); // Regional hints never confirm an official municipality.
    setLocationNeighborhood(""); // IP cannot establish a neighborhood.
  }, [draftReady, suggestedRegion?.city, suggestedRegion?.uf, city]);


  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-navy via-[#124b76] to-brand-navy px-4 pb-16 pt-8 sm:pt-12 md:pb-24 md:pt-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-glow absolute -top-24 -left-24 h-96 w-96 opacity-25 blur-2xl" />
          <div className="bg-glow absolute -right-32 top-10 h-[28rem] w-[28rem] opacity-20 blur-2xl" />
          <div className="bg-dot-grid absolute inset-0 text-primary/15 [mask-image:radial-gradient(60%_60%_at_50%_35%,black,transparent)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
          <div className="animate-rise min-w-0 rounded-[28px] border border-white/20 bg-card p-5 shadow-[0_24px_70px_-24px_rgba(0,0,0,.45)] sm:p-8 md:p-9">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Rede nacional · cadastro gratuito para o técnico
            </span>
            <h1 className="mt-5 max-w-[15ch] text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-[3.5rem]">
              Encontre ajuda técnica com mais clareza.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Pesquise por especialidade e localidade, conheça os perfis publicados e combine o serviço diretamente com o profissional.
            </p>
            {!draftReady ? (
              <div role="status" aria-live="polite" aria-busy="true"
                className="mt-7 flex min-h-16 items-center rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Recuperando sua busca…
              </div>
            ) : (
            <form
              aria-label="Buscar técnicos por especialidade e localidade"
              className="mt-7 grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border bg-muted/40 p-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const location = homeLocationFilters(
                  locationUf, city, cityIbgeId, officialCities, locationNeighborhood);
                if (!location) {
                  setCitySelectionError(true);
                  return;
                }
                setCitySelectionError(false);
                const category = canonicalHomeCategory(specialty, activeCategories);
                window.__lovableEvents?.track?.("project.technician_search", {
                  has_specialty: category !== "Todas",
                  has_city: location.cidade !== "",
                });
                navigate({
                  to: "/tecnicos",
                  search: { especialidade: category, cidade: location.cidade, uf: location.uf,
                    bairro: location.bairro, regiao: "", prioridade: location.prioridade },
                });
              }}
            >
              <HomeCategoryPicker value={specialty} categories={activeCategories}
                loading={categoriesLoading} error={categoriesError}
                onChange={(value) => {
                  saveUiTextDraft("home", { specialty: value, city, uf: locationUf,
                    neighborhood: locationNeighborhood, cityid: cityIbgeId === null ? "" : String(cityIbgeId) });
                  setSpecialty(value);
                }} />
              <HomeMunicipalitySearch uf={locationUf} cityName={city}
                selectedId={cityIbgeId} cities={officialCities}
                loading={citiesLoading} error={citiesError} retry={retryCities}
                showValidationError={citySelectionError}
                onUfChange={(uf) => {
                  cityEditedByUser.current = true;
                  setLocationUf(uf);
                  setCity("");
                  setCityIbgeId(null);
                  setLocationNeighborhood("");
                  setCitySelectionError(false);
                }}
                onCityTextChange={(value) => {
                  cityEditedByUser.current = true;
                  setCity(value);
                  setCityIbgeId(null);
                  setLocationNeighborhood("");
                  setCitySelectionError(false);
                }}
                onSelectCity={(selected) => {
                  cityEditedByUser.current = true;
                  setLocationUf(selected.uf);
                  setCity(selected.name);
                  setCityIbgeId(selected.id);
                  setLocationNeighborhood(previous =>
                    city === selected.name ? previous : "");
                  setCitySelectionError(false);
                }} />
              <button
                type="submit"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:col-span-2"
              >
                <Search className="h-4 w-4" aria-hidden="true" /> Encontrar profissionais
              </button>
            </form>
            )}
            <ul aria-label="Especialidades populares" className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {CHIPS.map(({ i: I, t }) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-medium text-foreground shadow-sm">
                  <I className="h-3.5 w-3.5 text-primary" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative animate-rise [animation-delay:150ms] rounded-[30px] border border-white/20 bg-white/10 p-2 shadow-[0_25px_80px_-20px_rgba(0,0,0,.5)]">
            <img src={heroImg} alt="Técnico instalando câmeras de segurança em uma residência" width={1280} height={1024} fetchPriority="high" decoding="async" className="aspect-[5/4] w-full rounded-[22px] object-cover shadow-soft" />
            <div className="absolute -bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-soft sm:left-7 sm:right-auto sm:min-w-64">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><MapPin className="h-5 w-5" aria-hidden /></span>
              <div className="text-sm"><div className="font-semibold text-foreground">Comece pela sua região</div><div className="text-muted-foreground">Cidade e UF confirmadas</div></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Princípios do Encontre um Técnico" className="border-b border-border bg-background px-4 py-7 sm:py-9">
        <ul className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: I, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><I className="h-5 w-5" aria-hidden /></span>
              <div><h2 className="text-sm font-bold text-foreground">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-visual-servicos" className="px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Escolha pelo contexto</p>
              <h2 id="home-visual-servicos" className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Que tipo de ajuda você procura?</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Comece pelo problema mais próximo do seu e encontre serviços e profissionais na sua região.</p>
            </div>
            <Link to="/servicos" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              Explorar todos os serviços <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOME_VISUALS.map((item) => (
              <li key={item.slug}>
                <Link to="/servicos/$categoria" params={{ categoria: item.slug }}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/50 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <div className="overflow-hidden bg-brand-navy/10">
                    <img src={item.src} alt={item.alt} width={1200} height={630} loading="lazy" decoding="async"
                      className="aspect-[40/21] w-full object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transform-none" />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0"><h3 className="font-bold text-foreground">{item.title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.subtitle}</p></div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HomePublicProof />

      <section className="bg-muted/35 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl"><ProblemAssistant /></div>
      </section>

      <CanaisDeAtendimento />
      <HowItWorksRich />
      <CoverageSection />

      <HomeTechnicianJoin />
      <HomeCommunityInvite />

      <section aria-labelledby="home-expansao-rede" className="border-y border-primary/15 bg-primary/5 px-4 py-8 sm:py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Expansão nacional · rede em construção</p>
            <h2 id="home-expansao-rede" className="mt-2 text-xl font-extrabold text-foreground sm:text-2xl">Estamos ampliando a rede de profissionais</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Consulte as localidades prioritárias para novos cadastros. A lista não representa disponibilidade confirmada nem volume de solicitações.</p>
          </div>
          <Link to="/cobertura#expansao-da-rede" className="inline-flex min-h-11 items-center rounded-xl border border-primary/30 bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Ver localidades procuradas
          </Link>
        </div>
      </section>

      <SponsoredPublicSlot slotKey="home.content_1" routePath="/" />
      <AdSensePublicUnit />
      <FaqPreview />
      <ContactBand />
    </PageShell>
  );
}
