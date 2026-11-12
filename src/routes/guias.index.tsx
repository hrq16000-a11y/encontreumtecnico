import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { getGuideArtwork } from "@/lib/guide-artwork";
import { SERVICE_CATEGORIES, getEnrichedServiceCategory } from "@/lib/service-catalog";
import { SITE } from "@/lib/public-sitemap";

/** Historic /guias hub now serves as a thematic bridge INTO the directory.
 * It is not a chronological blog or a competing news section.
 */
export const Route = createFileRoute("/guias/")({
  head: () => ({
    meta: [
      { title: "Assuntos por especialidade — Encontre um Técnico" },
      { name: "description", content: "Navegue por necessidades técnicas e acesse categorias com prestadores cadastrados, orientações práticas e solicitação de atendimento em um só lugar." },
      { property: "og:title", content: "Serviços técnicos por especialidade — Encontre um Técnico" },
      { property: "og:description", content: "Escolha uma necessidade e vá diretamente à categoria de serviços, profissionais e atendimento." },
      { property: "og:url", content: SITE + "/guias" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: SITE + "/guias" }],
  }),
  component: ServiceTopicsNavigation,
});

function ServiceTopicsNavigation() {
  const enriched = SERVICE_CATEGORIES.flatMap(category => {
    const entry = getEnrichedServiceCategory(category.slug);
    return entry ? [entry] : [];
  });

  return (
    <PageShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav aria-label="Caminho de navegação" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Início</Link> / <Link to="/servicos" className="hover:underline">Especialidades</Link> / Assuntos
        </nav>
        <header className="mt-6 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Navegação por necessidade</p>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground sm:text-4xl">Encontre a especialidade do serviço que você precisa</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Em vez de um blog separado, as orientações estão junto das categorias de profissionais.
            Escolha um assunto para consultar explicações práticas, perfis públicos e o atendimento guiado no mesmo lugar.
          </p>
        </header>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {enriched.map(({ category, guide }, index) => (
            <li key={category.slug} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <Link to="/servicos/$categoria" params={{ categoria: category.slug }} className="block overflow-hidden"
                aria-label={"Explorar " + category.name}>
                <img src={getGuideArtwork(guide.categorySlug).src} alt={getGuideArtwork(guide.categorySlug).alt}
                  width={1200} height={630} loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"} decoding="async"
                  className="aspect-video w-full object-cover transition-transform duration-300 hover:scale-[1.025]" />
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Especialidade técnica</p>
                <h2 className="mt-2 text-xl font-bold text-card-foreground">{category.name}</h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{category.description}</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">Informações práticas: {guide.title}</p>
                <Link to="/servicos/$categoria" params={{ categoria: category.slug }}
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
                  Ver profissionais e informações desta categoria →
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <section className="mt-10 rounded-2xl border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-bold text-foreground">Não encontrou sua necessidade?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Veja as demais especialidades, escolha sua cidade ou bairro e consulte os perfis que informaram atuar na região.
            O portal não divulga dados privados de contato sem autorização.
          </p>
          <Link to="/servicos" className="mt-4 inline-flex min-h-11 items-center font-bold text-primary hover:underline">
            Abrir o catálogo completo de especialidades →
          </Link>
        </section>
      </main>
    </PageShell>
  );
}
