import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { getPublishedGuide, getRelatedGuides } from "@/lib/public-guides";
import { GuideSectionVisual } from "@/components/guide-section-visual";
import { GuideLeadCallout } from "@/components/guide-lead-callout";
import { getGuideArtwork } from "@/lib/guide-artwork";
import { SITE } from "@/lib/public-sitemap";

export const Route = createFileRoute("/guias/$slug")({
  loader: ({ params }) => {
    const guide = getPublishedGuide(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData, params }) => {
    const guide = loaderData;
    const canonical = SITE + "/guias/" + (guide?.slug ?? params.slug);
    const hero = guide ? SITE + getGuideArtwork(guide.categorySlug).src : undefined;
    return {
      meta: [
        { title: guide ? guide.title + " | Encontre um Técnico" : "Guia não encontrado — Encontre um Técnico" },
        { name: "description", content: guide?.description ?? "Guia técnico indisponível." },
        { property: "og:title", content: guide?.title ?? "Guia técnico" },
        { property: "og:description", content: guide?.description ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        ...(hero ? [{ property: "og:image", content: hero }, { property: "og:image:alt", content: getGuideArtwork(guide!.categorySlug).alt }] : []),
        ...(guide ? [{
          "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: guide.description,
            inLanguage: "pt-BR",
            datePublished: guide.publishedAt,
            dateModified: guide.updatedAt,
            mainEntityOfPage: canonical,
            image: hero,
            author: { "@type": "Organization", name: "Encontre um Técnico — equipe editorial" },
            publisher: { "@type": "Organization", name: "Encontre um Técnico", url: SITE },
            isAccessibleForFree: true,
          },
        }] : []),
        ...(guide ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const guide = Route.useLoaderData();
  const artwork = getGuideArtwork(guide.categorySlug);
  const relatedGuides = getRelatedGuides(guide.slug);
  return (
    <PageShell>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <nav aria-label="Caminho de navegação" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Início</Link>
          <span aria-hidden="true">/</span>
          <Link to="/guias" className="hover:underline">Guias</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground">{guide.categoryName}</span>
        </nav>
        <article className="mt-7">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{guide.categoryName}</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">{guide.title}</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{guide.introduction}</p>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Conteúdo editorial do Encontre um Técnico · Publicado em {new Date(guide.publishedAt + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })} · Orientação informativa, sem diagnóstico ou endosso de prestadores.
            </p>
          </header>
          <figure className="mt-7 overflow-hidden rounded-2xl border border-border bg-brand-navy shadow-xl">
            <img src={artwork.src} alt={artwork.alt}
              width={1200} height={630} fetchPriority="high" className="h-auto w-full object-cover" />
            <figcaption className="border-t border-white/10 px-4 py-3 text-xs text-slate-100">
              Ilustração editorial e informativa, não diagnóstico ou projeto de instalação.
            </figcaption>
          </figure>
          <GuideLeadCallout guide={guide} compact />
          <div className="mt-9 space-y-8">
            {guide.sections.map((section, index) => (
              <div key={section.heading}>
              <section aria-labelledby={"secao-" + index}
                className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                <h2 id={"secao-" + index} className="text-xl font-bold text-card-foreground">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-sm leading-7 text-foreground sm:text-base">{paragraph}</p>
                ))}
                {section.checklist && (
                  <div className="mt-5 rounded-xl bg-muted/40 p-4">
                    <h3 className="text-sm font-bold text-foreground">Itens para conferir</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                      {section.checklist.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                <GuideSectionVisual categorySlug={guide.categorySlug} index={index} />
              </section>
              {(index === 1 || index === 3) && <GuideLeadCallout guide={guide} compact />}
              </div>
            ))}
          </div>
          <aside className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground">Próximo passo: encontre a especialidade adequada</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{guide.finalAdvice}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/tecnicos" search={{ especialidade: guide.categorySlug, cidade: "", regiao: "" }}
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
                Buscar técnicos de {guide.categoryName} →
              </Link>
              <Link to="/guias"
                className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-5 text-sm font-semibold text-primary hover:underline">
                Ver outros guias
              </Link>
            </div>
          </aside>
          <section aria-labelledby="guias-relacionados" className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
            <h2 id="guias-relacionados" className="text-xl font-bold text-foreground">Outros recursos para seu próximo passo</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Aprenda mais, conheça a cobertura publicada e encontre outras iniciativas do ecossistema de serviços.</p>
            {relatedGuides.length > 0 && (
              <ul className="mt-4 space-y-3">
                {relatedGuides.map((item) => (
                  <li key={item.slug}>
                    <Link to="/guias/$slug" params={{ slug: item.slug }}
                      className="inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
                      Leia também: {item.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link to="/guias" className="font-semibold text-primary hover:underline">Outros guias →</Link>
              <Link to="/cobertura" className="font-semibold text-primary hover:underline">Cobertura declarada →</Link>
              <Link to="/ecossistema" className="font-semibold text-primary hover:underline">Ecossistema de soluções →</Link>
            </div>
          </section>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            A disponibilidade, a área de atendimento e os serviços são declarados pelo profissional.
            O portal não avalia nem certifica a competência técnica e não disponibiliza contatos privados livremente.
          </p>
        </article>
      </main>
    </PageShell>
  );
}
