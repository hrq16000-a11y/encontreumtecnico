import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Wrench,
  UsersRound,
  ClipboardList,
  Megaphone,
  MailOpen,
  Tags,
  Archive,
  UserCheck,
  ChartNoAxesCombined,
  Menu,
  X,
  ShieldBan,
  PhoneCall,
  ChevronDown,
  Search,
  Star,
} from "lucide-react";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin-sections";
import {
  ADMIN_NAV_FAVORITES_KEY,
  ADMIN_NAV_GROUPS,
  matchingAdminNavKeys,
  sanitizeAdminFavorites,
} from "@/lib/admin-navigation-preferences";
import { AdminGlobalSearch } from "@/components/admin-global-search";

const ICONS = {
  inicio: LayoutDashboard,
  tecnicos: Wrench,
  clientes: UsersRound,
  contas: ShieldBan,
  contatos: PhoneCall,
  solicitacoes: ClipboardList,
  patrocinadores: Megaphone,
  mensagens: MailOpen,
  catalogo: Tags,
  legado: Archive,
  reivindicacoes: UserCheck,
  metricas: ChartNoAxesCombined,
} satisfies Record<AdminSection, typeof LayoutDashboard>;

export function AdminNavigation({ active }: { active: AdminSection }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moduleQuery, setModuleQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<AdminSection[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const root = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setMobileOpen(false);
  }, [active]);
  useEffect(() => {
    try {
      setFavorites(
        sanitizeAdminFavorites(
          JSON.parse(window.localStorage.getItem(ADMIN_NAV_FAVORITES_KEY) ?? "[]"),
        ),
      );
    } catch {
      setFavorites([]);
    }
    setFavoritesLoaded(true);
  }, []);
  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      window.localStorage.setItem(ADMIN_NAV_FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // Local storage may be unavailable in private browsing.
    }
  }, [favorites, favoritesLoaded]);
  useEffect(() => {
    if (!mobileOpen) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setMobileOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [mobileOpen]);

  const hasQuery = moduleQuery.trim().length > 0;
  const matches = new Set(matchingAdminNavKeys(moduleQuery));
  const visibleFavorites = favorites.filter((key) => matches.has(key));

  function toggleFavorite(key: AdminSection) {
    setFavorites((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : sanitizeAdminFavorites([...current, key]),
    );
  }

  function moduleLink(key: AdminSection, shortcut = false) {
    const item = ADMIN_SECTIONS.find((section) => section.key === key);
    if (!item) return null;
    const Icon = ICONS[item.key];
    const chosen = item.key === active;
    const favorite = favorites.includes(key);
    const linkClass =
      "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
      (chosen ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent");
    const content = (
      <>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{item.label}</span>
      </>
    );
    return (
      <div
        key={`${shortcut ? "favorite" : "module"}:${key}`}
        className="flex min-w-0 items-center gap-1 rounded-xl border border-transparent hover:border-border"
      >
        {key === "inicio" ? (
          <Link
            to="/admin"
            onClick={() => setMobileOpen(false)}
            aria-current={chosen ? "page" : undefined}
            className={linkClass}
          >
            {content}
          </Link>
        ) : (
          <Link
            to="/admin/$secao"
              params={{ secao: item.key }}
            onClick={() => setMobileOpen(false)}
            aria-current={chosen ? "page" : undefined}
            className={linkClass}
          >
            {content}
          </Link>
        )}
        <button
          type="button"
          onClick={() => toggleFavorite(key)}
          aria-pressed={favorite}
          aria-label={`${favorite ? "Remover" : "Adicionar"} ${item.label} ${favorite ? "dos" : "aos"} favoritos`}
          title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={"h-4 w-4 " + (favorite ? "fill-amber-400 text-amber-600" : "")}
            aria-hidden="true"
          />
        </button>
      </div>
    );
  }
  return (
    <aside ref={root} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="hidden border-b border-border px-2 pb-4 lg:block">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">
            Central de comando
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Módulos administrativos</p>
        </div>
        <button
          type="button"
          aria-controls="eut-admin-navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground lg:hidden"
        >
          <span className="flex min-w-0 items-center gap-2">
            {mobileOpen ? (
              <X className="h-5 w-5 shrink-0" />
            ) : (
              <Menu className="h-5 w-5 shrink-0" />
            )}
            Menu administrativo
          </span>
          <span className="max-w-[42%] truncate text-xs text-primary-foreground/90">
            {active === "inicio"
              ? "Início"
              : ADMIN_SECTIONS.find((item) => item.key === active)?.label}
          </span>
        </button>
        <AdminGlobalSearch />
        <nav
          id="eut-admin-navigation"
          aria-label="Menu administrativo"
          className={
            "mt-3 min-w-0 gap-3 pb-2 lg:flex lg:flex-col lg:overflow-visible " +
            (mobileOpen ? "flex max-h-[65vh] flex-col overflow-y-auto" : "hidden")
          }
        >
          <div className="relative min-w-0">
            <label
              htmlFor="eut-admin-module-filter"
              className="mb-1 block px-1 text-xs font-semibold text-muted-foreground"
            >
              Filtrar módulos do menu
            </label>
            <Search
              className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="eut-admin-module-filter"
              type="search"
              value={moduleQuery}
              onChange={(event) => setModuleQuery(event.target.value)}
              placeholder="Ex.: técnicos, mensagens"
              className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {visibleFavorites.length > 0 && (
            <section
              aria-label="Atalhos favoritos"
              className="min-w-0 space-y-1 rounded-xl border border-primary/15 bg-primary/5 p-2"
            >
              <h2 className="flex items-center gap-2 px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                <Star className="h-3.5 w-3.5" aria-hidden="true" /> Favoritos
              </h2>
              {visibleFavorites.map((key) => moduleLink(key, true))}
            </section>
          )}
          {ADMIN_NAV_GROUPS.map((group) => {
            const keys = group.keys.filter((key) => matches.has(key));
            if (keys.length === 0) return null;
            const expanded = hasQuery || !collapsed[group.id];
            const contentId = `eut-admin-nav-${group.id}`;
            return (
              <section key={group.id} className="min-w-0 rounded-xl border border-border/70 p-1">
                <h2>
                  <button
                    type="button"
                    aria-controls={contentId}
                    aria-expanded={expanded}
                    disabled={hasQuery}
                    onClick={() =>
                      setCollapsed((current) => ({ ...current, [group.id]: !current[group.id] }))
                    }
                    className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                  >
                    {group.title}
                    <ChevronDown
                      className={
                        "h-4 w-4 shrink-0 transition-transform " + (expanded ? "" : "-rotate-90")
                      }
                      aria-hidden="true"
                    />
                  </button>
                </h2>
                <div id={contentId} hidden={!expanded} className="min-w-0 space-y-1">
                  {keys.map((key) => moduleLink(key))}
                </div>
              </section>
            );
          })}
          {matches.size === 0 && (
            <p
              role="status"
              className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground"
            >
              Nenhum módulo encontrado. Ajuste a pesquisa ou use a busca global acima.
            </p>
          )}
        </nav>
        <p className="mt-3 hidden border-t border-border px-2 pt-3 text-xs leading-5 text-muted-foreground lg:block">
          Somente contas com autorização administrativa podem acessar os dados. A navegação não
          concede permissões.
        </p>
      </div>
    </aside>
  );
}
