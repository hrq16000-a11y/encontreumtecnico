import { createContext, useContext, type ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { CookieNotice } from "./cookie-notice";
import { BackToTop } from "./back-to-top";

export const LP2EmbeddedContext = createContext(false);

export function PageShell({ children }: { children: ReactNode }) {
  const embedded = useContext(LP2EmbeddedContext);
  if (embedded) return <main className="lp2-embedded-page">{children}</main>;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="flex-1">{children}</main>
      <SiteFooter />
      <CookieNotice />
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
