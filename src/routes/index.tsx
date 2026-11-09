import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, HandCoins, Eye, Scale, Camera, Laptop, Wifi, Printer, MapPin, Search } from "lucide-react";
import logo from "@/assets/logo-encontreumtecnico.png.asset.json";
import heroImg from "@/assets/tecnico-cftv-instalacao.jpg";
import techImg from "@/assets/tecnica-informatica.jpg";
import { PageShell } from "../components/page-placeholder";
import { ProblemAssistant } from "../components/problem-assistant";
import { CATEGORIES } from "../lib/categories";
import { FindOneSection, JoinNetworkSection, CtaBand, ValuesSection, StepsSection } from "../components/home-sections";

const SITE = "https://find-your-trusted-technician.lovable.app";
const TITLE = "Encontre um Técnico — Portal nacional de técnicos de CFTV e informática, sem custo para o profissional";
const DESC = "Portal brasileiro que conecta clientes a técnicos de CFTV, informática, redes e impressoras com transparência: perfis aprovados, sem cobrar do profissional e sem leilão de preço.";

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
              logo: SITE + logo.url,
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
  { icon: BadgeCheck, title: "Perfis aprovados", text: "Cada técnico passa por análise antes de aparecer." },
  { icon: HandCoins, title: "Sem custo para o profissional", text: "O técnico não paga para estar na rede nem por contato." },
  { icon: Eye, title: "Transparência", text: "Especialidades, cidade e status claros em cada perfil." },
  { icon: Scale, title: "Valorização do técnico", text: "Sem leilão de preço: o profissional define seu trabalho." },
];

function HomePage() {
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");

  return (
    <PageShell>
      <section className="relative overflow-hidden bg-gradient-to-b from-accent to-background px-4 pb-16 pt-12 md:pb-24 md:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Portal nacional · sem custo para o profissional
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-foreground md:text-6xl">
              Precisou? <span className="text-primary">Encontrou!</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Técnicos de CFTV, informática, redes e impressoras aprovados na sua cidade — com transparência e valorização de quem faz o serviço.
            </p>
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
                search: { especialidade: specialty.trim() || "Todas", cidade: city.trim(), regiao: "" },
              });
            }}
          >
            <label className="sr-only" htmlFor="busca-especialidade">Especialidade</label>
            <input
              id="busca-especialidade"
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Especialidade (ex.: Computador)"
              className="h-11 min-h-11 w-full shrink-0 sm:w-auto sm:flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <label className="sr-only" htmlFor="busca-cidade">Cidade</label>
            <input
              id="busca-cidade"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
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
            <ul className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {[{ i: Camera, t: "CFTV" }, { i: Laptop, t: "Informática" }, { i: Wifi, t: "Redes" }, { i: Printer, t: "Impressoras" }].map(({ i: I, t }) => (
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

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold text-foreground">Categorias de atividades populares</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <li key={category}>
              <Link
                to="/tecnicos"
                search={{ especialidade: category, cidade: "", regiao: "" }}
                onClick={() => window.__lovableEvents?.track?.("project.category_selected", { category })}
                className="block rounded-lg border border-border bg-card px-4 py-5 text-center text-sm font-medium text-card-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-12">
        <ProblemAssistant />
      </section>

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

      <FindOneSection />
      <JoinNetworkSection />
      <CtaBand />
      <ValuesSection />
      <StepsSection />

      <section className="border-t border-border bg-muted/40 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-semibold text-foreground">Como funciona</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              { step: "1", title: "Busque", text: "Pesquise por especialidade, cidade ou região." },
              { step: "2", title: "Escolha", text: "Compare perfis de técnicos aprovados pela plataforma." },
              { step: "3", title: "Solicite", text: "Abra uma solicitação de atendimento com segurança." },
            ].map((item) => (
              <li key={item.step} className="rounded-lg border border-border bg-card p-6">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-3 font-semibold text-card-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-card-foreground">Sou Cliente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre-se e abra solicitações de atendimento com técnicos aprovados.
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
