import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";
import { getEnrichedServiceCategory } from "@/lib/service-catalog";
import { getPublicServiceCategories } from "@/lib/public-service-catalog.functions";

import { AirVent, ArrowUpRight, BookOpen, Cctv, CircuitBoard, Laptop, MonitorCog, Palette, Printer, RadioTower, Search, Wifi, Wrench, Zap, type LucideIcon } from "lucide-react";

const SERVICE_ICONS = {
  climatizacao: AirVent,
  automacao: CircuitBoard,
  cftv: Cctv,
  computadores: Laptop,
  comunicacoes: RadioTower,
  eletrica: Zap,
  "design-grafico": Palette,
  impressoras: Printer,
  redes: Wifi,
  software: MonitorCog,
} satisfies Record<string, LucideIcon>;

function ServiceIcon({ slug }: { slug: string }) {
  const Icon = SERVICE_ICONS[slug as keyof typeof SERVICE_ICONS] ?? Wrench;
  return <Icon className="h-6 w-6" aria-hidden="true" />;
}


export const Route = createFileRoute("/servicos")({
  loader: () => getPublicServiceCategories(),
  // Child category routes own their metadata: do not emit a second /servicos canonical.
  head: ({ matches }) => matches.some(match => match.pathname.startsWith("/servicos/")) ? {} : ({
    meta: [
      { title: "Serviços e especialidades técnicas — Encontre um Técnico" },
      { name: "description", content: "Explore as categorias de serviços técnicos disponíveis e filtre profissionais por especialidade, cidade e região. Contatos privados continuam protegidos." },
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
  const { categories, services, unavailable, servicesUnavailable }: Awaited<ReturnType<typeof getPublicServiceCategories>> = Route.useLoaderData();
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
        {unavailable ? (
          <p role="status" className="mt-6 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            O catálogo de categorias está temporariamente indisponível. Você ainda pode consultar os técnicos publicados.
          </p>
        ) : categories.length === 0 ? (
          <p role="status" className="mt-6 rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
            Nenhuma categoria está habilitada no momento.
          </p>
        ) : null}
        {!unavailable && servicesUnavailable && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Os serviços específicos não estão disponíveis neste momento; as categorias seguem acessíveis.
          </p>
        )}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((service) => (
            <li key={service.slug} className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><ServiceIcon slug={service.slug} /></span>
              <h2 className="font-semibold text-card-foreground">{service.label}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{service.description}</p>
              {services.some((item) => item.category_slug === service.slug) && (
                <div className="mt-4 border-t border-border pt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">Serviços específicos disponíveis</h3>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Serviços de ${service.label}`}>
                    {services.filter((item) => item.category_slug === service.slug).map((item) => (
                      <li key={item.slug}>
                        <Link
                          to="/tecnicos"
                          search={{ especialidade: service.slug, servico: item.slug, cidade: "", regiao: "" }}
                          title={item.description || undefined}
                          className="inline-flex min-h-10 items-center rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {getEnrichedServiceCategory(service.slug) ? (
                <Link
                  to="/servicos/$categoria" params={{ categoria: service.slug }}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" /> Ver especialidade, profissionais e orientações <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  to="/tecnicos"
                  search={{ especialidade: service.slug, cidade: "", regiao: "" }}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <Search className="h-4 w-4" aria-hidden="true" /> Encontrar técnicos desta especialidade <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
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
            Algumas especialidades incluem orientações detalhadas; todas as categorias habilitadas pelo painel
            levam à busca de profissionais. Consulte também os guias para assuntos técnicos frequentes.
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
<p className="mx-auto my-5 w-full max-w-6xl px-4 text-sm leading-7 text-muted-foreground">Depois de identificar o serviço, consulte a <a href="/cobertura" className="font-semibold text-primary underline underline-offset-2">rede de técnicos por município</a>. Ao pedir orçamento, diga qual equipamento precisa de atenção e se a falha acontece sempre ou apenas em determinadas condições.</p>
    </PageShell>
  );
}
