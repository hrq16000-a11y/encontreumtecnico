import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { SERVICE_CATEGORIES, getEnrichedServiceCategory } from "@/lib/service-catalog";
import { getExactGuideArtwork } from "@/lib/guide-artwork";
import { ArrowUpRight, Wrench } from "lucide-react";

const SERVICES = SERVICE_CATEGORIES;

export const Route = createFileRoute("/servicos")({
  // Child category routes own their metadata: do not emit a second /servicos canonical.
  head: ({ matches }) => matches.some(match => match.pathname.startsWith("/servicos/")) ? {} : ({
    meta: [
      { title: "Serviços e especialidades técnicas — Encontre um Técnico" },
      { name: "description", content: "Explore dez categorias de serviços técnicos e filtre profissionais por especialidade, cidade e região. Contatos privados continuam protegidos." },
      { property: "og:title", content: "Serviços e especialidades — Encontre um Técnico" },
      { property: "og:description", content: "Encontre profissionais cadastrados por tipo de serviço e confira suas regiões de atendimento declaradas." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.encontreumtecnico.com.br/servicos" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.encontreumtecnico.com.br/servicos" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const isCategoryDetail = useRouterState({ select: state => state.location.pathname.startsWith("/servicos/") });
  // TanStack file route /servicos is the parent of /servicos/$categoria.
  // It must render the nested Outlet or the child can only contribute metadata.
  if (isCategoryDetail) return <Outlet />;
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Serviços e especialidades técnicas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma categoria para abrir a busca já filtrada. Confira os serviços e cidades declarados pelos profissionais;
          a plataforma não certifica a habilitação técnica nem garante disponibilidade.
        </p>
        <SponsoredPublicSlot slotKey="services.content_1" routePath="/servicos" />
        <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(service => {
            const artwork = getExactGuideArtwork(service.slug);
            const enriched = getEnrichedServiceCategory(service.slug);
            return (
              <li key={service.slug}
                className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-[box-shadow,border-color] motion-safe:duration-200 hover:border-primary/50 hover:shadow-soft focus-within:border-primary/60">
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-accent via-secondary to-muted">
                  {artwork ? (
                    <img src={artwork.src} alt={artwork.alt} width={1200} height={630}
                      loading="lazy" decoding="async"
                      className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.035] motion-reduce:transform-none" />
                  ) : (
                    <div className="flex h-full items-center justify-center" role="img"
                      aria-label={"Ícone ilustrativo da área " + service.name}>
                      <Wrench aria-hidden="true" className="h-14 w-14 text-primary/70" />
                    </div>
                  )}
                  <span className="absolute bottom-3 left-3 rounded-full border border-white/40 bg-brand-navy/85 px-3 py-1.5 text-xs font-semibold text-brand-navy-foreground">
                    Ilustração da especialidade
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-bold text-card-foreground">{service.name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{service.description}</p>
                  {enriched ? (
                    <Link to="/servicos/$categoria" params={{ categoria: service.slug }}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-1 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      Ver orientações e profissionais
                      <ArrowUpRight className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link to="/tecnicos" search={{ especialidade: service.slug, cidade: "", regiao: "" }}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      Encontrar técnicos desta área
                      <ArrowUpRight className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <section aria-labelledby="orientacoes-servicos" className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
          <h2 id="orientacoes-servicos" className="text-xl font-bold text-foreground">Como encontrar o profissional adequado</h2>
          <ol className="mt-4 grid gap-5 text-sm leading-6 text-muted-foreground md:grid-cols-3">
            <li><strong className="block text-foreground">1. Escolha a especialidade</strong>O filtro apresenta apenas os profissionais que informaram atuar naquela categoria.</li>
            <li><strong className="block text-foreground">2. Confira a cidade</strong>Revise a região de atendimento declarada e os serviços específicos do perfil, sem presumir disponibilidade.</li>
            <li><strong className="block text-foreground">3. Explique a necessidade</strong>Descreva equipamento, problema e urgência pelo atendimento guiado. O telefone do técnico permanece privado.</li>
          </ol>
          <p className="mt-5 text-xs text-muted-foreground">
            O cadastro é livre e gratuito para profissionais. A publicação do perfil não significa certificação ou avaliação técnica.
          </p>
        </section>
        <aside className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <h2 className="text-lg font-bold text-foreground">Antes de solicitar um atendimento</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            As informações práticas agora ficam dentro de cada especialidade, junto à busca de profissionais.
            A navegação de assuntos conecta computadores, câmeras, redes, impressoras e outras necessidades reais.
          </p>
          <Link to="/guias" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
            Navegar pelos assuntos das especialidades →
          </Link>
        </aside>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não sabe qual especialidade escolher?{" "}
          <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }}
            className="font-semibold text-primary underline-offset-4 hover:underline">
            Veja todos os perfis publicados
          </Link>.
        </p>
      </section>
    </PageShell>
  );
}
