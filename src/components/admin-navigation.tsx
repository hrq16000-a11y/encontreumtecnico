import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Wrench, UsersRound, ClipboardList, Megaphone,
  MailOpen, Tags, Archive, UserCheck, ChartNoAxesCombined, Menu, X, ShieldBan, PhoneCall,
} from "lucide-react";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin-sections";

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
  const root = useRef<HTMLElement | null>(null);
  useEffect(() => { setMobileOpen(false); }, [active]);
  useEffect(() => {
    if (!mobileOpen) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setMobileOpen(false);
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
  return (
    <aside ref={root} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="hidden border-b border-border px-2 pb-4 lg:block">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Central de comando</p>
          <p className="mt-1 text-xs text-muted-foreground">Módulos administrativos</p>
        </div>
        <button type="button" aria-controls="eut-admin-navigation" aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className="flex min-h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground lg:hidden">
          <span className="flex items-center gap-2">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            Menu administrativo</span>
          <span className="text-xs text-primary-foreground/90">{active === "inicio" ? "Início" : ADMIN_SECTIONS.find((item) => item.key === active)?.label}</span>
        </button>
        <nav id="eut-admin-navigation" aria-label="Menu administrativo"
          className={"mt-3 gap-1 pb-2 lg:flex lg:flex-col lg:overflow-visible " +
            (mobileOpen ? "flex max-h-[65vh] flex-col overflow-y-auto" : "hidden")}>
          {ADMIN_SECTIONS.map((item) => {
            const Icon = ICONS[item.key];
            const chosen = item.key === active;
            const className = "flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (chosen ? "border-primary/20 bg-primary text-primary-foreground shadow-sm" : "border-transparent text-foreground hover:border-border hover:bg-accent");
            const content = <><Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="whitespace-nowrap">{item.label}</span></>;
            return item.key === "inicio" ? (
              <Link key={item.key} to="/admin" onClick={() => setMobileOpen(false)} aria-current={chosen ? "page" : undefined} className={className}>{content}</Link>
            ) : (
              <Link key={item.key} to="/admin/$secao" params={{ secao: item.key }} onClick={() => setMobileOpen(false)}
                aria-current={chosen ? "page" : undefined} className={className}>{content}</Link>
            );
          })}
        </nav>
        <p className="mt-3 hidden border-t border-border px-2 pt-3 text-xs leading-5 text-muted-foreground lg:block">
          Somente contas com autorização administrativa podem acessar os dados. A navegação não concede permissões.
        </p>
      </div>
    </aside>
  );
}
