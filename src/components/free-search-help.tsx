import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { showMobileQuickTabs } from "@/lib/navigation-safety";
// The complete wizard (regional hint, Supabase, drafts and validation) is only
// needed after an explicit help request. Keep the global event listener and
// floating CTA on public routes so cross-route requests and open drafts are preserved.
const LazyAssistanceFunnel = lazy(() =>
  import("./assistance-funnel").then(({ AssistanceFunnel }) => ({ default: AssistanceFunnel })),
);
import { type FreeHelpContext } from "@/lib/free-search-help";

/** Global guided service intake. Opens on explicit click or regional zero-results.
 * No free phone reveal, payment bypass or external WhatsApp jump.
 */
export function FreeSearchHelp() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hasMobileHelpTab = showMobileQuickTabs(pathname);
  // The technician Wizard has its own sticky mobile navigation at the bottom.
  // Keep the help dialog/event intact, but do not float a second CTA above it.
  const hasMobileTechnicianWizard = pathname === "/area-tecnico" || pathname === "/lp2/meu-perfil";
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<FreeHelpContext>({});
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onRequest = (event: Event) => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const detail = (event as CustomEvent<FreeHelpContext>).detail;
      setContext(detail && typeof detail === "object" ? detail : {});
      setOpen(true);
    };
    window.addEventListener("eut-open-free-help", onRequest);
    return () => window.removeEventListener("eut-open-free-help", onRequest);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const dialog = dialogRef.current;
      // Recalculate on each Tab: the lazy wizard changes its controls between steps.
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter(element =>
        element.tabIndex >= 0 && !element.closest("[hidden], [inert]") &&
        window.getComputedStyle(element).display !== "none" &&
        window.getComputedStyle(element).visibility !== "hidden",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey ? active === first || !dialog.contains(active) : active === last || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", key);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else triggerRef.current?.focus();
    };
  }, [open]);
  // Mobile quick tabs expose help without a floating button covering results.
  // Preserve the floating action on pages without tabs and on desktop.
  return (
    <>
      {!inAdmin && <button type="button" ref={triggerRef} aria-haspopup="dialog"
        aria-expanded={open} aria-controls="eut-free-help-dialog"
        onClick={() => { returnFocusRef.current = triggerRef.current; setContext({}); setOpen(true); }}
        className={"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 min-h-12 items-center gap-2 rounded-full border border-white/30 bg-brand-navy px-4 py-3 text-sm font-bold text-white shadow-[0_14px_42px_-14px_rgba(7,28,57,.7)] transition-transform hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none md:bottom-24 md:right-6 " + (hasMobileHelpTab || hasMobileTechnicianWizard ? "hidden md:inline-flex" : "inline-flex")}>
        <LifeBuoy className="h-5 w-5" aria-hidden="true" /> Preciso de ajuda
      </button>}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/65 backdrop-blur-[3px] sm:items-center sm:p-4"
          onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section id="eut-free-help-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"
            aria-labelledby="eut-help-title"
            className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl sm:max-w-xl sm:rounded-3xl">
            <div className="relative bg-gradient-to-r from-brand-navy to-primary p-5 text-white sm:p-6">
              <button type="button" ref={closeRef} onClick={() => setOpen(false)}
                aria-label="Fechar atendimento" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="text-xs font-bold uppercase tracking-widest text-white/85">Atendimento inteligente</span>
              <h2 id="eut-help-title" className="mt-2 pr-10 text-2xl font-black text-white">Precisou de um técnico? Encontrou o caminho.</h2>
              <p className="mt-2 text-sm text-white/85">Escolha acesso direto ou suporte da equipe. Sem divulgação de telefones privados.</p>
            </div>
            <Suspense fallback={
              <div role="status" aria-live="polite" className="px-5 py-8 text-sm text-muted-foreground">
                Carregando atendimento seguro…
              </div>
            }>
              <LazyAssistanceFunnel key={JSON.stringify(context)} context={context} onClose={() => setOpen(false)} />
            </Suspense>
          </section>
        </div>
      )}
    </>
  );
}
