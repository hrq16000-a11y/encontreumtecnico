import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { GuideSectionVisual } from "@/components/guide-section-visual";
import { GuideLeadCallout } from "@/components/guide-lead-callout";
import { GuideReadingNavigation, GuideFrequentlyAskedQuestions } from "@/components/guide-reading-tools";
import { getGuideArtwork } from "@/lib/guide-artwork";
import { getRelatedServiceCategories } from "@/lib/service-catalog";
import { getEnrichedServiceCategory } from "@/lib/service-catalog";
import { listApprovedTechnicians } from "@/lib/technicians.functions";
import type { PublicTechnician } from "@/lib/technicians.functions";
import { SITE } from "@/lib/public-sitemap";

export const Route = createFileRoute("/servicos/$categoria")({
  loader: async ({ params }) => {
    const entry = getEnrichedServiceCategory(params.categoria);
    if (!entry) throw notFound();
    // Existing public listing enforces approved status, published fields and RLS.
    // Do not reimplement its eligibility/ban logic or expose contact details.
    try {
      const technicians = await listApprovedTechnicians({
        data: { especialidade: entry.category.slug, cidade: "", regiao: "", servico: "", uf: "", bairro: "", prioridade: "" },
      });
      return { technicians: technicians.slice(0, 6), listingUnavailable: false };
    } catch {
      // Editorial content can remain available during transient directory errors,
      // but never imply there are no technicians when the lookup failed.
      return { technicians: [], listingUnavailable: true };
    }
  },
  head: ({ params }) => {
    const entry = getEnrichedServiceCategory(params.categoria);
    const canonical = SITE + "/servicos/" + (entry?.category.slug ?? params.categoria);
    if (!entry) return {
      meta: [{ title: "Categoria não encontrada — Encontre um Técnico" }, { name: "robots", content: "noindex, nofollow" }],
      links: [{ rel: "canonical", href: SITE + "/servicos" }],
    };
    const { category, guide } = entry;
    const title = category.name + ": profissionais e orientações para contratar | Encontre um Técnico";
    const description = category.description + " Compare perfis aprovados por especialidade e região e prepare o pedido de atendimento.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "website" },
        { property: "og:image", content: SITE + getGuideArtwork(guide.categorySlug).src },
        { "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: category.name + " — Encontre um Técnico",
          description,
          inLanguage: "pt-BR",
          url: canonical,
          isPartOf: { "@type": "WebSite", name: "Encontre um Técnico", url: SITE },
          about: { "@type": "Service", name: category.name },
        } },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: ServiceCategoryPage,
});

function ServiceCategoryPage() {
  const { categoria } = Route.useParams();
  const entry = getEnrichedServiceCategory(categoria);
  const { technicians, listingUnavailable }: { technicians: PublicTechnician[]; listingUnavailable: boolean } = Route.useLoaderData();
  // Loader rejects unknown and thin categories with a real HTTP 404.
  if (!entry) return null;
  const { category, guide } = entry;
  const artwork = getGuideArtwork(guide.categorySlug);
  const relatedCategories = getRelatedServiceCategories(category.slug);
  const directorySearch = { especialidade: category.slug, cidade: "", regiao: "" };

  return (
    <PageShell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Caminho de navegação" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Início</Link><span aria-hidden="true">/</span>
          <Link to="/servicos" className="hover:underline">Especialidades</Link><span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground">{category.name}</span>
        </nav>

        <header className="mt-6 max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Catálogo de prestadores · Especialidade</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">Encontre profissionais de {category.name.toLocaleLowerCase("pt-BR")}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{category.description}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Consulte perfis publicados, confirme a cidade e a especialidade declarada e descreva a sua necessidade.
            O portal não certifica profissionais, não garante disponibilidade e mantém contatos privados protegidos.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/tecnicos" search={directorySearch}
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Buscar todos os profissionais desta categoria →
            </Link>
            <Link to="/area-cliente" search={{ modo: "regional", categoria: category.slug }}
              className="inline-flex min-h-11 items-center rounded-xl border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary/5">
              Guardar pedido da minha região
            </Link>
            <Link to="/cadastro"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary hover:bg-muted/50">
              Sou profissional — cadastrar gratuitamente
            </Link>
            <a href="#orientacoes-da-especialidade"
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary hover:bg-muted/50">
              Informações para contratar
            </a>
          </div>
        </header>

        <section aria-labelledby="profissionais-da-categoria" className="mt-9 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 id="profissionais-da-categoria" className="text-xl font-bold text-foreground">
            Profissionais cadastrados nesta especialidade
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A seleção abaixo mostra até seis perfis públicos aprovados nesta consulta. A busca completa permite filtrar município, estado, bairro e serviço.
          </p>
          {listingUnavailable ? (
            <p role="status" className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              A consulta de perfis está temporariamente indisponível. Tente a busca completa mais tarde; nenhuma disponibilidade foi presumida.
            </p>
          ) : technicians.length === 0 ? (
            <p className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              Nenhum perfil desta categoria apareceu nesta consulta. Isso não significa ausência de cobertura em todas as cidades.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {technicians.map(technician => (
                <li key={technician.id}>
                  <Link to="/tecnicos/$tecnicoId" params={{ tecnicoId: technician.public_slug }}
                    className="flex h-full flex-col rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={"Ver o perfil público de " + technician.display_name}>
                    <span className="text-base font-bold text-foreground">{technician.display_name}</span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      {[technician.city, technician.state_uf].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-auto pt-4 text-sm font-semibold text-primary">Consultar perfil e serviços →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/tecnicos" search={directorySearch}
            className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
            Abrir a busca por especialidade e localidade →
          </Link>
        </section>

        <article id="orientacoes-da-especialidade" className="eut-guide-stable-type mt-10 scroll-mt-28">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Informação prática dentro da especialidade</p>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">{guide.title}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{guide.introduction}</p>
          </div>
          <figure className="mt-6 overflow-hidden rounded-2xl border border-border bg-brand-navy">
            <img src={artwork.src} alt={artwork.alt} width={1200} height={630}
              decoding="async" loading="lazy" className="h-auto w-full object-cover" />
            <figcaption className="border-t border-white/10 px-4 py-3 text-xs text-slate-100">
              Ilustração informativa da especialidade; não substitui diagnóstico ou orçamento.
            </figcaption>
          </figure>
          <GuideReadingNavigation guide={guide} />
          <GuideLeadCallout guide={guide} compact />
          <div className="mt-9 space-y-8">
            {guide.sections.map((section, index) => (
              <div key={section.heading}>
                <section aria-labelledby={"secao-" + index}
                  className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <h3 id={"secao-" + index} className="scroll-mt-28 text-xl font-bold text-card-foreground">{section.heading}</h3>
                  {section.paragraphs.map(paragraph => (
                    <p key={paragraph} className="mt-4 text-sm leading-7 text-foreground sm:text-base">{paragraph}</p>
                  ))}
                  {section.checklist && (
                    <div className="mt-5 rounded-xl bg-muted/40 p-4">
                      <h4 className="text-sm font-bold text-foreground">Pontos para conferir</h4>
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
          <GuideFrequentlyAskedQuestions guide={guide} />
          <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground">Solicite atendimento da especialidade certa</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{guide.finalAdvice}</p>
            <Link to="/tecnicos" search={directorySearch}
              className="mt-4 inline-flex min-h-11 items-center font-bold text-primary hover:underline">
              Ver profissionais de {category.name.toLocaleLowerCase("pt-BR")} →
            </Link>
          </div>
        </article>

        <section id="guias-relacionados" aria-labelledby="conteudos-relacionados" className="mt-10 scroll-mt-28 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 id="conteudos-relacionados" className="text-xl font-bold text-foreground">Especialidades relacionadas</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Para uma necessidade diferente, navegue entre as especialidades e encontre os profissionais que declaram atendê-las.
          </p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {relatedCategories.map(related => (
              <li key={related.slug}>
                <Link to="/servicos/$categoria" params={{ categoria: related.slug }}
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary hover:bg-muted/60">
                  {related.name} →
                </Link>
              </li>
            ))}
            <li>
              <Link to="/servicos" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-primary hover:bg-muted/60">
                Todas as especialidades →
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </PageShell>
  );
}
