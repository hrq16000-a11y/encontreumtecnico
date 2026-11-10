import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";
import { getApprovedTechnician } from "../lib/technicians.functions";
import { isValidTechnicianId, isValidTechnicianSlug } from "@/lib/technician-id";
import { categoryLabel, useActiveCategories } from "@/hooks/use-active-categories";
import { useActiveServices, serviceLabel } from "@/hooks/use-active-services";

export const Route = createFileRoute("/tecnicos/$tecnicoId")({
  // A published profile that does not exist must return a genuine HTTP 404,
  // not a content-filled HTTP 200 (soft 404). A database failure remains 500.
  loader: async ({ params }) => {
    const isLegacyUuid = isValidTechnicianId(params.tecnicoId);
    if (!isLegacyUuid && !isValidTechnicianSlug(params.tecnicoId)) throw notFound();
    const technician = await getApprovedTechnician({ data: { id: params.tecnicoId } });
    if (!technician) throw notFound();
    // Old UUID shares remain valid, but never compete with the readable canonical.
    if (isLegacyUuid) throw redirect({
      to: "/tecnicos/$tecnicoId", params: { tecnicoId: technician.public_slug }, statusCode: 301,
    });
    return technician;
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.display_name;
    const title = name ? `${name} — Técnico em ${loaderData.city} | Encontre um Técnico` : "Perfil do técnico — Encontre um Técnico";
    const desc = name
      ? `${name}: ${loaderData.specialties.join(", ")} em ${loaderData.city}.`
      : "Perfil público do técnico, especialidades e regiões atendidas.";
    const canonical = `https://www.encontreumtecnico.com/tecnicos/${loaderData?.public_slug ?? params.tecnicoId}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: canonical },
        ...(!loaderData ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
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
          <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">{t.display_name}</h1>
            {t.referral_highlight && <p className="mt-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Destaque por indicações · profissionais convidados com perfis públicos</p>}
            {t.pioneer_bronze && <p className="mt-2 inline-flex rounded-full border border-amber-700/30 bg-amber-800/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">Pioneiro Bronze · registro histórico confirmado</p>}
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
              className="mt-6 mr-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Descrever problema para este técnico
            </Link>
            <Link to="/acesso-contato/$tecnicoId" params={{ tecnicoId: t.id }}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Ver condições de acesso ao contato
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              O envio da descrição é opcional, com consentimento explícito. O contato é privado. O pagamento por conveniência ainda não está disponível;
              nenhum número é exibido sem aquisição confirmada.
            </p>
          </div>
      </section>
    </PageShell>
  );
}
