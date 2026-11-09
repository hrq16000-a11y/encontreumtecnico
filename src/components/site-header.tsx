import { useState } from "react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-encontreumtecnico.png.asset.json";

const NAV_ITEMS = [
  { to: "/", label: "Início" },
  { to: "/tecnicos", label: "Técnicos" },
  { to: "/servicos", label: "Serviços" },
  { to: "/como-funciona", label: "Como funciona" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center" aria-label="Encontre um Técnico — página inicial">
          <img src={logo.url} alt="Encontre um Técnico" width={324} height={60} className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/entrar"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 py-3 md:hidden" aria-label="Navegação móvel">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  activeProps={{ className: "block rounded-md px-3 py-2 text-sm font-medium bg-accent text-foreground" }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/entrar"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Entrar
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
