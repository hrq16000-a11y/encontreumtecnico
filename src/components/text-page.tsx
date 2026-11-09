import type { ReactNode } from "react";
import { PageShell } from "./page-placeholder";

export function TextPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {intro && <p className="mt-2 text-sm text-muted-foreground">{intro}</p>}
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">{children}</div>
        <p className="mt-10 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Texto provisório — será revisado antes da homologação.
        </p>
      </section>
    </PageShell>
  );
}

export function TextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

export function pageHead(title: string, description: string) {
  const full = `${title} — Encontre um Técnico`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
