import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Clock3, Home, LockKeyhole, MapPin, RefreshCw, Search, SearchX, Wrench } from "lucide-react";
import logo from "@/assets/logo-branco.png";
import heroPhoto from "@/assets/tecnica-informatica.jpg";
import { FRIENDLY_ERROR_COPY, type FriendlyErrorStatus } from "../lib/friendly-error-copy";

type FriendlyErrorStateProps = {
  status: FriendlyErrorStatus;
  onRetry?: () => void;
};

/**
 * A branded recovery screen, inspired by the old WordPress 404.
 * Search uses an actual supported filter (city) instead of an unimplemented keyword query.
 */
export function FriendlyErrorState({ status, onRetry }: FriendlyErrorStateProps) {
  const content = FRIENDLY_ERROR_COPY[status];
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const Symbol = status === 404 ? SearchX : status === 403 ? LockKeyhole : status === 503 ? Clock3 : Wrench;

  const retry = () => {
    if (onRetry) onRetry();
    else window.location.reload();
  };

  const searchTechnicians = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const destination = city.trim();
    if (!destination) return;
    void navigate({
      to: "/tecnicos",
      search: {
        especialidade: "Todas",
        cidade: destination,
        regiao: "",
        servico: "",
        uf: "",
        bairro: "",
      },
    });
  };

  return (
    <div className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#10263b] text-white">
      <title>{content.label} | Encontre um Técnico</title>
      <meta name="robots" content="noindex,nofollow" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-[position:30%_center] bg-no-repeat opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(90deg,rgba(8,25,43,.76),rgba(11,32,53,.86) 45%,rgba(9,26,45,.95)),url(" + heroPhoto + ")",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 78% 10%,rgba(34,173,220,.15),transparent 42%),linear-gradient(180deg,rgba(9,22,38,.06),rgba(9,22,38,.55))",
        }}
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-7">
        <Link to="/" aria-label="Encontre um Técnico — início" className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49d0fa]">
          <img src={logo} alt="Encontre um Técnico" className="h-10 w-auto max-w-[220px] object-contain sm:h-12" width={220} height={50} />
        </Link>
        <Link to="/tecnicos" className="hidden items-center gap-2 text-sm font-semibold text-white/85 transition hover:text-white sm:inline-flex">
          Ver profissionais <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-12 text-center sm:px-8">
        <section aria-labelledby="friendly-error-title" className="w-full max-w-3xl">
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-bold tracking-[.2em] text-[#69d9ff] uppercase">
            <Symbol size={18} aria-hidden="true" />
            {content.label}
          </div>
          <div
            aria-hidden="true"
            className="select-none text-[clamp(6rem,21vw,13rem)] leading-[.85] font-black tracking-[-.075em] text-white drop-shadow-[0_12px_32px_rgba(0,0,0,.15)]"
          >
            {status}
          </div>
          <h1 id="friendly-error-title" className="mt-6 text-[clamp(1.85rem,4.6vw,3rem)] leading-tight font-bold tracking-tight text-white">
            {content.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#dfedf6] sm:text-lg">
            {content.description}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#bdd4e5]">
            {content.suggestion}
          </p>

          {status === 404 && (
            <form onSubmit={searchTechnicians} role="search" className="mx-auto mt-8 flex w-full max-w-2xl flex-col items-stretch gap-3 sm:flex-row">
              <label htmlFor="friendly-error-city" className="sr-only">Cidade para encontrar um técnico</label>
              <div className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-4 backdrop-blur-sm transition focus-within:border-[#5ed9ff] focus-within:ring-2 focus-within:ring-[#5ed9ff]/35">
                <MapPin className="shrink-0 text-[#87dfff]" size={18} aria-hidden="true" />
                <input
                  id="friendly-error-city"
                  type="search"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  required
                  maxLength={100}
                  autoComplete="address-level2"
                  placeholder="Em qual cidade você precisa de ajuda?"
                  className="h-12 min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-[#c4d4e4] sm:text-base"
                />
              </div>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17b7e9] px-6 py-3 text-sm font-bold text-[#071d31] shadow-lg shadow-black/15 transition hover:bg-[#58d7fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Search size={18} aria-hidden="true" /> Procurar
              </button>
            </form>
          )}

          <nav aria-label="Opções para continuar" className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {status !== 404 && (
              content.actionHref ? (
                <Link to={content.actionHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17b7e9] px-6 py-3 text-sm font-bold text-[#071d31] transition hover:bg-[#58d7fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <Symbol size={18} aria-hidden="true" /> {content.actionLabel}
                </Link>
              ) : (
                <button type="button" onClick={retry} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17b7e9] px-6 py-3 text-sm font-bold text-[#071d31] transition hover:bg-[#58d7fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <RefreshCw size={18} aria-hidden="true" /> {content.actionLabel}
                </button>
              )
            )}
            <Link to="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <Home size={18} aria-hidden="true" /> Voltar à página inicial
            </Link>
            {status === 404 && (
              <Link to="/tecnicos" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <Search size={18} aria-hidden="true" /> Ver todos os técnicos
              </Link>
            )}
          </nav>

          <p className="mt-10 text-sm text-[#d9e7f0]">
            Precisa de orientação?{" "}
            <Link to="/contato" className="font-bold text-[#88e3ff] underline underline-offset-4 transition hover:text-white">
              Fale com a equipe
            </Link>
          </p>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-t border-white/15 px-5 py-6 text-xs text-[#acc9dd] sm:px-8">
        <span>Encontre um Técnico · Precisou? Encontrou!</span>
        <Link to="/" className="inline-flex shrink-0 items-center gap-1 hover:text-white">
          <ArrowLeft size={14} aria-hidden="true" /> Início
        </Link>
      </footer>
    </div>
  );
}
