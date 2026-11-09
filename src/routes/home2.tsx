import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Search, MapPin, Briefcase, Star, TrendingUp, ShieldCheck, Zap, Menu, ArrowRight } from "lucide-react";
import { CATEGORIES } from "../lib/categories";

/**
 * Home2 é uma LP visual independente da Home1.
 * Não importar PageShell, home-sections, SiteHeader ou SiteFooter.
 * A classe raiz isola tipografia, background e cores deste design.
 */
export const Route = createFileRoute("/home2")({
  head: () => ({
    meta: [
      { title: "Home2 — Encontre um Técnico" },
      { name: "description", content: "Encontre profissionais e serviços por especialidade e cidade." },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://encontreumtecnico.com/home2" }],
  }),
  component: Home2Landing,
});

// Fonte única: categorias operacionais do portal, sem listas decorativas divergentes.


function Home2Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="/home2" className="flex items-center gap-2" aria-label="Home2 Encontre um Técnico">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xl font-bold text-white">E</span>
          <span className="text-xl font-bold text-zinc-900">Encontre<span className="text-emerald-600">Um</span></span>
        </a>
        <nav aria-label="Navegação da Home2" className="hidden items-center gap-6 text-sm font-medium text-zinc-700 sm:flex">
          <a href="/tecnicos" className="hover:text-emerald-600">Buscar técnicos</a>
          <a href="/entrar" className="hover:text-emerald-600">Entrar</a>
          <a href="/cadastro" className="rounded-full bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-800">Cadastrar-se</a>
        </nav>
        <a href="/entrar" aria-label="Entrar na plataforma" className="sm:hidden"><Menu size={24} /></a>
      </div>
    </header>
  );
}

function Home2Footer() {
  return (
    <footer className="bg-zinc-900 px-4 py-14 text-zinc-300">
      <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-3">
        <div>
          <div className="text-xl font-bold text-white">Encontre<span className="text-emerald-500">Um</span></div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">Profissionais e serviços perto de você, com busca por especialidade e localização.</p>
        </div>
        <nav aria-label="Links da Home2" className="flex flex-col gap-3 text-sm">
          <a href="/tecnicos" className="hover:text-white">Encontrar técnico</a>
          <a href="/cadastro" className="hover:text-white">Cadastrar profissional</a>
          <a href="/" className="hover:text-white">Conhecer o portal principal</a>
        </nav>
        <div className="text-sm">
          <p>Home2 — Landing page alternativa</p>
          <p className="mt-3 text-zinc-400">© {new Date().getFullYear()} Encontre um Técnico.</p>
        </div>
      </div>
    </footer>
  );
}

function Home2Landing() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({ especialidade: query.trim() || "Todas", cidade: city, regiao: "" });
    window.location.assign("/tecnicos?" + params.toString());
  }

  const categoryHref = (category: string) => "/tecnicos?" + new URLSearchParams({ especialidade: category, cidade: "", regiao: "" }).toString();

  return (
    <div className="home2-lp min-h-screen bg-white font-sans text-zinc-900 selection:bg-emerald-100">
      <Home2Header />
      <main>
        <section className="relative flex min-h-[600px] items-center justify-center overflow-hidden bg-zinc-900">
          <div className="absolute inset-0 opacity-40" aria-hidden="true">
            <img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&q=80&w=1920" alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/60 to-zinc-900" />
          </div>
          <div className="relative z-10 mx-auto w-full max-w-4xl space-y-8 px-4 py-20 text-center">
            <div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
                Encontre os melhores <span className="text-emerald-500">profissionais</span> e <span className="text-emerald-500">empresas</span> perto de você.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-300 md:text-xl">
                Busque por especialidade e cidade para descobrir profissionais da sua região.
              </p>
            </div>
            <form onSubmit={search} role="search" className="flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/10 p-2 shadow-2xl backdrop-blur-md md:flex-row">
              <label className="flex flex-1 items-center rounded-xl bg-white px-4 py-3">
                <Search className="mr-3 h-5 w-5 text-zinc-400" aria-hidden="true" />
                <span className="sr-only">Serviço procurado</span>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="O que você procura? (ex: CFTV)" className="w-full bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400" />
              </label>
              <label className="flex flex-1 items-center rounded-xl bg-white px-4 py-3">
                <MapPin className="mr-3 h-5 w-5 text-zinc-400" aria-hidden="true" />
                <span className="sr-only">Cidade</span>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Em qual cidade?" className="w-full bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400" />
              </label>
              <button type="submit" className="rounded-xl bg-emerald-600 px-8 py-3 font-bold text-white shadow-lg transition-colors hover:bg-emerald-500">Buscar agora</button>
            </form>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-300">
              <span>Populares:</span>
              {CATEGORIES.slice(0, 5).map(cat => <a key={cat} href={categoryHref(cat)} className="underline decoration-zinc-500 underline-offset-4 hover:text-emerald-400">{cat}</a>)}
            </div>
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <h2 className="text-3xl font-bold">Por que usar o Encontre Um?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-600">Uma experiência simples para procurar profissionais por serviço e localização.</p>
            <div className="mt-16 grid gap-12 md:grid-cols-3">
              {[
                { Icon: Star, title: "Perfis de profissionais", text: "Consulte as informações disponíveis antes de solicitar atendimento.", color: "text-emerald-600 bg-emerald-50" },
                { Icon: TrendingUp, title: "Busca por localidade", text: "Filtre por cidade e encontre especialidades para o serviço que precisa.", color: "text-blue-600 bg-blue-50" },
                { Icon: ShieldCheck, title: "Contato protegido", text: "Acesse o fluxo de identificação para solicitar contato com um profissional.", color: "text-purple-600 bg-purple-50" },
              ].map(({Icon,title,text,color}) => (
                <div key={title} className="flex flex-col items-center space-y-4 rounded-3xl border border-zinc-100 p-8 transition-shadow hover:shadow-xl">
                  <div className={"flex h-16 w-16 items-center justify-center rounded-2xl " + color}><Icon className="h-8 w-8" /></div>
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="text-zinc-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-zinc-50 py-24">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="text-3xl font-bold">Categorias em destaque</h2><p className="mt-2 text-zinc-600">Explore os serviços por especialidade.</p></div>
              <a href="/tecnicos" className="font-semibold text-emerald-600 hover:underline">Ver todos <ArrowRight className="inline h-4 w-4" /></a>
            </div>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
              {CATEGORIES.map(cat => <a key={cat} href={categoryHref(cat)} className="group flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-6 text-center transition-all hover:border-emerald-500 hover:shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-50 text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-600"><Briefcase className="h-6 w-6" /></div>
                <span className="font-semibold">{cat}</span>
              </a>)}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-emerald-600 py-24">
          <div className="pointer-events-none absolute -right-20 -top-48 h-96 w-96 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="relative mx-auto max-w-5xl space-y-8 px-4 text-center text-white">
            <h2 className="text-4xl font-bold leading-tight">É profissional autônomo ou possui uma empresa?</h2>
            <p className="mx-auto max-w-2xl text-xl text-emerald-50">Cadastre seu perfil e apresente suas especialidades e regiões de atendimento.</p>
            <a href="/cadastro" className="inline-flex items-center gap-2 rounded-full bg-white px-10 py-4 font-bold text-emerald-700 shadow-xl hover:bg-zinc-100">Cadastrar gratuitamente <Zap className="h-4 w-4" /></a>
          </div>
        </section>
      </main>
      <Home2Footer />
    </div>
  );
}
