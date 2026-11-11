import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { showMobileQuickTabs } from "@/lib/navigation-safety";
import { ArrowRight, CircleHelp, House, LogIn, Menu, Search, Wrench, X, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo-marinho.png";

const NAV_ITEMS = [
  { to: "/", label: "Início", icon: House },
  { to: "/tecnicos", label: "Encontrar técnicos", icon: Search },
  { to: "/servicos", label: "Serviços", icon: Wrench },
  { to: "/como-funciona", label: "Como funciona", icon: CircleHelp },
] as const;

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, roles, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showQuickTabs = showMobileQuickTabs(pathname);
  // Server-controlled roles. Never infer admin privileges from the e-mail.
  const accountPath = roles.includes("admin") ? "/admin" as const
    : roles.includes("tecnico") ? "/area-tecnico" as const
    : roles.includes("cliente") ? "/area-cliente" as const
    : "/entrar" as const;
  const signedIn = !loading && Boolean(user);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 35);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <>
    <header className={"sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-xl transition-shadow duration-300 " + (scrolled ? "shadow-md" : "shadow-sm")}>
      <a href="#conteudo-principal" className={"sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground " + FOCUS}>
        Ir para o conteúdo
      </a>
      <div aria-hidden="true" className="h-[3px] bg-gradient-to-r from-primary via-brand-glow to-primary" />
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="Encontre um Técnico — página inicial"
          className={"group flex min-w-0 shrink-0 items-center gap-3 rounded-lg " + FOCUS}
          onClick={() => setOpen(false)}
        >
          <img src={logo} alt="Encontre um Técnico" width={324} height={60}
            className="h-9 w-auto max-w-[185px] object-contain transition-transform duration-200 group-hover:scale-[1.025] sm:h-10 sm:max-w-[218px] motion-reduce:transform-none" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {NAV_ITEMS.filter((item) => item.to !== "/tecnicos").map((item) => (
            <Link key={item.to} to={item.to}
              className={"rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground " + FOCUS}
              activeProps={{ className: "rounded-full bg-primary/10 px-3 py-2 text-sm font-semibold text-primary" }}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {signedIn ? (
            <Link to={accountPath}
              className={"inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 " + FOCUS}>
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Minha conta
            </Link>
          ) : (
            <>
              <Link to="/entrar"
                className={"inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent " + FOCUS}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> Entrar
              </Link>
              <Link to="/area-tecnico"
                className={"inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/25 bg-card px-4 text-sm font-semibold text-primary shadow-sm transition-colors hover:border-primary hover:bg-accent " + FOCUS}>
                Sou técnico
              </Link>
            </>
          )}
          <Link to="/tecnicos"
            className={"inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md motion-reduce:transform-none " + FOCUS}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Encontrar técnico
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <button type="button" aria-expanded={open} aria-controls="eut-mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen(value => !value)}
          className={"inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent lg:hidden " + FOCUS}>
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav id="eut-mobile-menu" className="eut-menu-enter border-t border-border bg-background px-4 pb-5 pt-3 shadow-lg sm:px-6 lg:hidden"
          aria-label="Navegação móvel">
          <div className="mx-auto max-w-7xl">
            <ul className="grid gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link to={item.to} onClick={() => setOpen(false)}
                      className={"flex min-h-12 items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent " + FOCUS}
                      activeProps={{ className: "flex min-h-12 items-center gap-3 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary" }}>
                      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {item.label}
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {!signedIn && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Link to="/area-cliente" onClick={() => setOpen(false)}
                className={"inline-flex min-h-12 items-center justify-center rounded-xl border border-input bg-card px-3 text-center text-sm font-semibold text-foreground " + FOCUS}>
                Sou cliente
              </Link>
              <Link to="/area-tecnico" onClick={() => setOpen(false)}
                className={"inline-flex min-h-12 items-center justify-center rounded-xl border border-primary/30 bg-accent px-3 text-center text-sm font-semibold text-primary " + FOCUS}>
                Sou técnico
              </Link>
            </div>}
            <Link to={signedIn ? accountPath : "/entrar"} onClick={() => setOpen(false)}
              className={"mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm " + FOCUS}>
              {signedIn ? <UserRound className="h-4 w-4" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
              {signedIn ? "Minha conta" : "Entrar ou criar conta"}
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">Cadastro gratuito para profissionais · contato privado protegido</p>
          </div>
        </nav>
      )}
    </header>
    {showQuickTabs && <nav aria-label="Acesso rápido no celular"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_22px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <Link to="/" activeOptions={{ exact: true }}
        className={"flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground " + FOCUS}
        activeProps={{ className: "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary" }}>
        <House className="h-5 w-5" aria-hidden="true" /> Início
      </Link>
      <Link to="/tecnicos"
        className={"flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground " + FOCUS}
        activeProps={{ className: "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary" }}>
        <Search className="h-5 w-5" aria-hidden="true" /> Buscar
      </Link>
      <Link to={signedIn ? accountPath : "/entrar"}
        className={"flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground " + FOCUS}
        activeProps={{ className: "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary" }}>
        {signedIn ? <UserRound className="h-5 w-5" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />} Minha área
      </Link>
    </nav>}
    </>
  );
}
