import {
  LayoutDashboard, UserRound, MapPinned, Camera, Inbox,
  UsersRound, ShieldCheck, History,
} from "lucide-react";
import {
  TECHNICIAN_PANEL_TABS, technicianTabHref,
  type TechnicianPanelTab,
} from "@/lib/technician-panel-navigation";

const ICONS = {
  inicio: LayoutDashboard,
  perfil: UserRound,
  cobertura: MapPinned,
  foto: Camera,
  solicitacoes: Inbox,
  indicacoes: UsersRound,
  configuracoes: ShieldCheck,
  recuperacao: History,
} satisfies Record<TechnicianPanelTab, typeof LayoutDashboard>;

/** The links change the URL hash and show one real panel view at a time. */
export function TechnicianPanelNavigation({
  active, onChange,
}: {
  active: TechnicianPanelTab;
  onChange: (tab: TechnicianPanelTab) => void;
}) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="hidden px-3 pb-3 lg:block">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Minha área profissional</p>
          <p className="mt-1 text-sm text-muted-foreground">Escolha o que deseja gerenciar</p>
        </div>
        <nav aria-label="Navegação do painel do técnico"
          className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {TECHNICIAN_PANEL_TABS.map((tab) => {
            const Icon = ICONS[tab.key];
            const selected = tab.key === active;
            return (
              <a key={tab.key} href={technicianTabHref(tab.key)}
                aria-current={selected ? "page" : undefined}
                onClick={() => onChange(tab.key)}
                className={
                  "group flex min-h-12 shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors " +
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                  (selected
                    ? "border-primary/25 bg-primary text-primary-foreground shadow-sm"
                    : "border-transparent text-foreground hover:border-border hover:bg-accent")
                }>
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
