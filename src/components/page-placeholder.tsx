import { createContext, useContext, type ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { CookieNotice } from "./cookie-notice";
import { BackToTop } from "./back-to-top";
import { FreeSearchHelp } from "./free-search-help";

export const LP2EmbeddedContext = createContext(false);
/** Nested route shells become content-only inside the stable root frame. */
export const PersistentPageShellContext = createContext(false);

export function PageShell({ children }: { children: ReactNode }) {
  const embedded = useContext(LP2EmbeddedContext);
  const insidePersistentShell = useContext(PersistentPageShellContext);
  if (embedded) return <main className="lp2-embedded-page">{children}</main>;
  if (insidePersistentShell) return <>{children}</>;
  return (
    <div className="flex min-h-screen flex-col bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="eut-soft-arrival flex-1">
        <PersistentPageShellContext.Provider value={true}>{children}</PersistentPageShellContext.Provider>
      </main>
      <SiteFooter />
      <CookieNotice />
      <FreeSearchHelp />
      <BackToTop />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
