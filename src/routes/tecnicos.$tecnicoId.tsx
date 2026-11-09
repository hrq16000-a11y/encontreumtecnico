import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, EmptyState } from "../components/page-placeholder";
import { getApprovedTechnician } from "../lib/technicians.functions";

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
        { property: "og:url", content: `https://encontreumtecnico.com/tecnicos/${params.tecnicoId}` },
        ...(!loaderData ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: [{ rel: "canonical", href: `https://encontreumtecnico.com/tecnicos/${params.tecnicoId}` }],
    };
  },
  component: TechnicianProfilePage,
});

function TechnicianProfilePage() {
  const t = Route.useLoaderData();

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/tecnicos" className="text-sm text-primary hover:underline">← Voltar para técnicos</Link>
        {!t ? (
          <div className="mt-6">
            <EmptyState title="Perfil indisponível" description="Este técnico não existe ou ainda não foi aprovado." />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-card p-6">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground">{t.display_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.city}{t.region ? ` · ${t.region}` : ""}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {t.specialties.map((s) => (
                <li key={s} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">{s}</li>
              ))}
            </ul>
            {t.bio && <p className="mt-4 whitespace-pre-line text-sm text-foreground">{t.bio}</p>}
            <Link to="/area-cliente" search={{ tecnico: t.id }} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Solicitar atendimento
            </Link>
          </div>
        )}
      </section>
    </PageShell>
  );
}
