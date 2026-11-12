import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { getPublicCoverageOverview } from "@/lib/public-coverage.functions";
import { SITE } from "@/lib/public-sitemap";

export const Route = createFileRoute("/cobertura")({
  loader: () => getPublicCoverageOverview(),
  head: () => ({
    meta: [
      { title: "Onde há técnicos cadastrados — cobertura declarada | Encontre um Técnico" },
      { name: "description", content: "Consulte localidades declaradas por técnicos com perfis públicos. Confira a cidade-base informada, os profissionais cadastrados e serviços, sem promessa de disponibilidade." },
      { property: "og:title", content: "Cobertura declarada por técnicos cadastrados — Encontre um Técnico" },
      { property: "og:description", content: "Diretório atualizado a partir dos profissionais com perfil público, agrupados por localidade informada." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE + "/cobertura" },
    ],
    links: [{ rel: "canonical", href: SITE + "/cobertura" }],
  }),
  component: CoveragePage,
});

function CoveragePage() {
  const locations = Route.useLoaderData();
  const approvedCount = locations.reduce((total, location) => total + location.profiles.length, 0);

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav aria-label="Caminho de navegação" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Início</Link> / Cobertura declarada
        </nav>
        <header className="mt-6 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Busca nacional · dados declarados</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
            Localidades com profissionais cadastrados
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Consulte a cidade-base ou região informada pelos técnicos que possuem perfis públicos.
            A lista acompanha os cadastros aprovados: novos profissionais podem aparecer após a publicação,
            e perfis que deixam de ser públicos saem do diretório.
          </p>
          <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-foreground">
            <strong>{approvedCount} {approvedCount === 1 ? "perfil publicado" : "perfis publicados"}</strong>
            {" · "}
            <strong>{locations.length} {locations.length === 1 ? "localidade informada" : "localidades informadas"}</strong>.
            Estas quantidades refletem o catálogo público consultado, não a rede inteira nem um compromisso de atendimento.
          </p>
        </header>

        {locations.length === 0 ? (
          <div className="mt-9 rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground">Ainda não há localidades públicas nesta consulta</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use a busca geral para verificar novas publicações ou informar sua necessidade pela triagem.
            </p>
            <Link to="/tecnicos" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary">
              Abrir busca de técnicos →
            </Link>
          </div>
        ) : (
          <ul className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {locations.map(location => (
              <li key={location.uf + ":" + location.city} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">UF {location.uf} · região informada</p>
                <h2 className="mt-3 break-words text-xl font-bold text-foreground">{location.city}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {location.profiles.length} {location.profiles.length === 1 ? "perfil publicado" : "perfis publicados"} com esta localidade-base
                </p>
                <ul className="mt-4 space-y-2 border-t border-border pt-4">
                  {location.profiles.map(profile => (
                    <li key={profile.slug}>
                      <Link
                        to="/tecnicos/$tecnicoId" params={{ tecnicoId: profile.slug }}
                        className="block rounded-md py-2 text-sm font-semibold text-primary hover:underline">
                        Ver perfil: {profile.displayName} →
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to="/tecnicos"
                  search={{ especialidade: "Todas", cidade: location.city, regiao: "", uf: location.uf }}
                  className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary/5">
                  Buscar nesta localidade →
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="cobertura-significado" className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
          <h2 id="cobertura-significado" className="text-xl font-bold text-foreground">
            O que significa uma localidade aparecer nesta lista?
          </h2>
          <div className="mt-4 grid gap-5 text-sm leading-7 text-muted-foreground md:grid-cols-2">
            <p>
              A localidade é informada pelo próprio profissional como sua cidade-base ou área de referência.
              Em alguns cadastros, a descrição pode representar uma região metropolitana, não um município específico.
              O portal não deduz endereços, deslocamento, GPS ou horários a partir desse campo.
            </p>
            <p>
              Ter um perfil publicado não garante que o técnico esteja disponível, tenha habilitação específica
              ou atenda em seu endereço. Confira as especialidades e o alcance declarado, descreva o serviço
              desejado e confirme diretamente as condições antes de contratar.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/servicos" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
              Conhecer as especialidades →
            </Link>
            <Link to="/guias" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
              Preparar minha solicitação com os guias →
            </Link>
          </div>
        </section>
      </section>
    </PageShell>
  );
}
