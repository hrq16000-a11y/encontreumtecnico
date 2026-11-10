import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, EmptyState } from "../components/page-placeholder";
import { getApprovedTechnician } from "../lib/technicians.functions";
import { categoryLabel, useActiveCategories } from "@/hooks/use-active-categories";
import { useActiveServices, serviceLabel } from "@/hooks/use-active-services";

const UUID = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/tecnicos/$tecnicoId")({
  loader: ({ params }) =>
    UUID.test(params.tecnicoId) ? getApprovedTechnician({ data: { id: params.tecnicoId } }) : null,
  head: ({ loaderData, params }) => {
    const name = loaderData?.display_name;
    const title = name ? `${name} — Técnico em ${loaderData.city} | Encontre um Técnico` : "Perfil do técnico — Encontre um Técnico";
    const desc = name
      ? `${name}: ${loaderData.specialties.join(", ")} em ${loaderData.city}.`
      : "Perfil público do técnico, especialidades e regiões atendidas.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
        { property: "og:url", content: `https://www.encontreumtecnico.com/tecnicos/${params.tecnicoId}` },
        ...(!loaderData ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: [{ rel: "canonical", href: `https://www.encontreumtecnico.com/tecnicos/${params.tecnicoId}` }],
    };
  },
  component: TechnicianProfilePage,
});

function TechnicianProfilePage() {
  const t = Route.useLoaderData();
  const { categories } = useActiveCategories();
  const { services } = useActiveServices();

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/tecnicos" className="text-sm text-primary hover:underline">← Voltar para técnicos</Link>
        {!t ? (
          <div className="mt-6">
            <EmptyState title="Perfil indisponível" description="Este técnico não está disponível publicamente neste momento." />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card p-6">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">{t.display_name}</h1>
            {t.online_now && <p className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Online recentemente — disponibilidade de atendimento não garantida
            </p>}
            <p className="mt-1 text-sm text-muted-foreground">
              {t.city}{t.state_uf ? `/${t.state_uf}` : ""}{t.neighborhood ? ` · ${t.neighborhood}` : ""}{t.region ? ` · ${t.region}` : ""}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {t.specialties.map((s) => (
                <li key={s} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">{categoryLabel(s, categories)}</li>
              ))}
            </ul>
            {t.service_slugs.length > 0 && (
              <section className="mt-5" aria-label="Serviços específicos do técnico">
                <h2 className="text-sm font-semibold text-card-foreground">Serviços que realiza</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {t.service_slugs.map((slug) => <li key={slug} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{serviceLabel(slug, services)}</li>)}
                </ul>
              </section>
            )}
            {t.bio && <p className="mt-4 whitespace-pre-line text-sm text-foreground">{t.bio}</p>}
            <Link to="/area-cliente" search={{ tecnico: t.id }}
              className="mt-6 mr-3 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Descrever problema para este técnico
            </Link>
            <Link to="/acesso-contato/$tecnicoId" params={{ tecnicoId: t.id }}
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Ver condições de acesso ao contato
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              O envio da descrição é opcional, com consentimento explícito. O contato é privado. O pagamento por conveniência ainda não está disponível;
              nenhum número é exibido sem aquisição confirmada.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
