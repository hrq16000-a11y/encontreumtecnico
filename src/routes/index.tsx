import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, HandCoins, Eye, Scale, Camera, Laptop, Wifi, Printer, MapPin, Search } from "lucide-react";
import logo from "@/assets/logo-encontreumtecnico.png.asset.json";
import heroImg from "@/assets/tecnico-cftv-instalacao.jpg";
import techImg from "@/assets/tecnica-informatica.jpg";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { AdSensePublicUnit } from "@/components/adsense-public-unit";
import { HomePublicProof } from "@/components/home-public-proof";
import { HomeCommunityInvite } from "@/components/home-community-invite";
import { ProblemAssistant } from "../components/problem-assistant";
import { CustomerLocationButton } from "@/components/customer-location-button";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { readUiTextDraft, saveUiTextDraft } from "@/lib/unsent-ui-draft";
import { Reveal } from "../components/motion";
import {
  CategoryGrid,
  HowItWorksRich,
  CoverageSection,
  ApprovalProcessSection,
  FaqPreview,
  ContactBand,
} from "../components/home-rich";
import { FindOneSection, JoinNetworkSection, CtaBand, ValuesSection, StepsSection } from "../components/home-sections";

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
              email: "dpo@encontreumtecnico.com",
              telephone: "+55-41-99745-2053",
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

function HomePage() {
  const navigate = useNavigate();
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
      setLocationNeighborhood(saved["neighborhood"] ?? "");
      cityEditedByUser.current = Boolean(saved["city"]);
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady) return;
    saveUiTextDraft("home", { specialty, city, uf: locationUf, neighborhood: locationNeighborhood });
  }, [draftReady, specialty, city, locationUf, locationNeighborhood]);
  const { area: suggestedRegion, loading: regionLoading } = useRegionalSuggestion();
  useEffect(() => {
    // The user may edit while the lookup is pending; never override typed city.
    if (!draftReady || !suggestedRegion || city.trim() || cityEditedByUser.current) return;
    setCity(suggestedRegion.city);
    setLocationUf(suggestedRegion.uf);
    setLocationNeighborhood(suggestedRegion.neighborhood);
  }, [draftReady, suggestedRegion?.city, suggestedRegion?.uf, city]);


  return (
    <PageShell>
      <section className="relative overflow-hidden bg-gradient-to-b from-accent to-background px-4 pb-16 pt-12 md:pb-24 md:pt-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="bg-glow absolute -top-24 -left-24 h-96 w-96 opacity-25 blur-2xl" />
          <div className="bg-glow absolute -right-32 top-10 h-[28rem] w-[28rem] opacity-20 blur-2xl" />
          <div className="bg-dot-grid absolute inset-0 text-primary/15 [mask-image:radial-gradient(60%_60%_at_50%_35%,black,transparent)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Portal nacional · sem custo para o profissional
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-foreground md:text-6xl">
              Precisou? <span className="text-primary">Encontrou!</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Encontre prestadores cadastrados de CFTV, informática, redes e impressoras na sua região. Negocie diretamente, sem leilão de menor preço.
            </p>
            {!draftReady ? (
              <div role="status" aria-live="polite" aria-busy="true"
                className="mt-8 flex min-h-16 items-center rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
                Recuperando sua busca…
              </div>
            ) : (
            <form
              className="mt-8 flex flex-col gap-3 rounded-xl bg-card p-3 shadow-soft sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                window.__lovableEvents?.track?.("project.technician_search", {
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
              <label className="sr-only" htmlFor="busca-especialidade">Especialidade</label>
              <input
                id="busca-especialidade"
                type="text"
                value={specialty}
                onChange={(e) => { saveUiTextDraft("home", { specialty:e.target.value, city, uf:locationUf, neighborhood:locationNeighborhood }); setSpecialty(e.target.value); }}
                placeholder="Especialidade (ex.: Computador)"
                className="h-11 min-h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <label className="sr-only" htmlFor="busca-cidade">Cidade</label>
              <input
                id="busca-cidade"
                type="text"
                value={city}
                onChange={(e) => { cityEditedByUser.current = true; saveUiTextDraft("home", { specialty, city:e.target.value, uf:"", neighborhood:"" }); setCity(e.target.value); setLocationUf(""); setLocationNeighborhood(""); }}
                placeholder="Cidade ou região"
                className="h-11 min-h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="h-11 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Buscar
              </button>
            </form>
            )}
            <div className="mt-3 max-w-xl">
              <div aria-live="polite" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-card/90 px-4 py-3 text-xs shadow-sm sm:text-sm">
                <span className="flex items-start gap-2 text-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {suggestedRegion
                    ? <span><strong>Você pode estar em {suggestedRegion.city}/{suggestedRegion.uf}.</strong> <span className="text-muted-foreground">Estimativa aproximada; confira antes de pesquisar.</span></span>
                    : <span className="text-muted-foreground">{regionLoading ? "Buscando sua região aproximada…" : "Informe sua cidade para buscar técnicos."}</span>}
                </span>
                {suggestedRegion && <button type="button" onClick={() => document.getElementById("busca-cidade")?.focus()} className="min-h-10 rounded-lg border border-primary/25 px-3 text-xs font-semibold text-primary hover:bg-accent">Corrigir cidade</button>}
              </div>
              <CustomerLocationButton onLocated={(area, source) => {
                if (source === "automatic" && city.trim()) return;
                saveUiTextDraft("home", { specialty, city:area.city, uf:area.uf, neighborhood:area.neighborhood });
                setCity(area.city);
                setLocationUf(area.uf);
                setLocationNeighborhood(area.neighborhood);
              }} />
              {locationUf && city.trim() && (
                <Link
                  to="/tecnicos"
                  search={{
                    especialidade: specialty.trim() || "Todas",
                    cidade: city.trim(), regiao: "",
                    uf: locationUf, bairro: locationNeighborhood, prioridade: "regiao",
                  }}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-primary bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  Buscar técnicos em {city}/{locationUf}
                </Link>
              )}
            </div>
            <ul className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {CHIPS.map(({ i: I, t }) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-medium text-foreground shadow-sm">
                  <I className="h-3.5 w-3.5 text-primary" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative animate-rise [animation-delay:150ms]">
            <img src={heroImg} alt="Técnico instalando câmera de segurança na fachada de uma casa" width={1280} height={1024} className="aspect-[5/4] w-full rounded-3xl object-cover shadow-soft" />
            <div className="absolute -bottom-5 left-4 flex animate-float items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><MapPin className="h-5 w-5" aria-hidden /></span>
              <div className="text-sm"><div className="font-semibold text-foreground">Técnicos perto de você</div><div className="text-muted-foreground">Busque por cidade ou região</div></div>
            </div>
          </div>
        </div>
      </section>

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

      <Reveal><CategoryGrid /></Reveal>

      <HomePublicProof />

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <Reveal><ProblemAssistant /></Reveal>
      </section>

      <Reveal><HowItWorksRich /></Reveal>

      <AdSensePublicUnit />

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
        <img src={techImg} alt="Técnica de informática fazendo manutenção em computador e roteador" width={1280} height={960} loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-soft" />
        <div>
          <h2 className="text-3xl font-bold text-foreground">Aqui o profissional é valorizado</h2>
          <p className="mt-4 text-muted-foreground">
            Não cobramos do técnico para participar nem por cliente recebido, e não fazemos leilão de preço. O cliente encontra quem tem a especialidade certa, perto dele, e o técnico é reconhecido pelo seu trabalho.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/entrar" className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Sou técnico, quero participar</Link>
            <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:border-primary"><Search className="h-4 w-4" aria-hidden /> Ver técnicos</Link>
          </div>
        </div>
      </section>

      <HomeCommunityInvite />

      <Reveal><CoverageSection /></Reveal>
      <Reveal><ApprovalProcessSection /></Reveal>

      <FindOneSection />
      <JoinNetworkSection />
      <CtaBand />
      <ValuesSection />
      <StepsSection />

      <Reveal><FaqPreview /></Reveal>
      <Reveal><ContactBand /></Reveal>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-card-foreground">Sou Cliente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre-se, pesquise profissionais por região e negocie diretamente com o prestador.
            </p>
            <Link
              to="/entrar"
              className="mt-4 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Criar conta de cliente
            </Link>
          </div>
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-card-foreground">Sou Técnico</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Faça parte da rede de técnicos de TI do Brasil e seja encontrado por novos clientes.
            </p>
            <Link
              to="/entrar"
              className="mt-4 inline-block rounded-md border border-primary px-6 py-2.5 text-sm font-medium text-primary hover:bg-primary/5"
            >
              Criar conta de técnico
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
