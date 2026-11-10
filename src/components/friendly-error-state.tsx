import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Home, LockKeyhole, RefreshCw, SearchX, Wrench } from "lucide-react";
import logo from "@/assets/logo-marinho.png";
import { FRIENDLY_ERROR_COPY, type FriendlyErrorStatus } from "../lib/friendly-error-copy";

type FriendlyErrorStateProps = {
  status: FriendlyErrorStatus;
  onRetry?: () => void;
};

export function FriendlyErrorState({ status, onRetry }: FriendlyErrorStateProps) {
  const content = FRIENDLY_ERROR_COPY[status];
  const Symbol = status === 404 ? SearchX : status === 403 ? LockKeyhole : status === 503 ? Clock3 : Wrench;

  const retry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <title>{content.label} | Encontre um Técnico</title>
      <meta name="robots" content="noindex,nofollow" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-52 left-1/2 -z-10 h-[30rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" aria-label="Encontre um Técnico — início" className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <img src={logo} alt="Encontre um Técnico" className="h-9 w-auto max-w-[220px] object-contain" width={220} height={45} />
        </Link>
        <span className="hidden text-xs font-semibold tracking-wide text-muted-foreground sm:inline">PRECISOU? ENCONTROU!</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <section aria-labelledby="friendly-error-title" className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 text-center shadow-xl shadow-primary/5 sm:p-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/15 bg-primary/10 text-primary">
            <Symbol size={38} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{status} · {content.label}</p>
          <h1 id="friendly-error-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {content.title}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            {content.description}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {content.suggestion}
          </p>

          <nav aria-label="Opções para continuar" className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {content.actionHref ? (
              <Link to={content.actionHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <SearchX size={18} aria-hidden="true" />
                {content.actionLabel}
              </Link>
            ) : (
              <button type="button" onClick={retry} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <RefreshCw size={18} aria-hidden="true" />
                {content.actionLabel}
              </button>
            )}
            <Link to="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Home size={18} aria-hidden="true" />
              Voltar ao início
            </Link>
          </nav>

          <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            Precisa de orientação?{" "}
            <Link to="/contato" className="font-semibold text-primary underline-offset-4 hover:underline">
              Fale com a equipe
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pb-6 text-xs text-muted-foreground sm:px-8">
        <span>Encontre um Técnico</span>
        <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft size={14} aria-hidden="true" />
          Página inicial
        </Link>
      </footer>
    </div>
  );
}
