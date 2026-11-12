import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { PublicSeoDirectory } from "@/components/public-seo-discovery";
import { getSeoCity } from "@/lib/public-seo-graph.functions";
import { SITE } from "@/lib/public-sitemap";

export const Route = createFileRoute("/cidades/$uf/$cidade")({
  loader: async ({ params }) => {
    const result = await getSeoCity({ data: { uf: params.uf, city: params.cidade } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `Técnicos em ${loaderData.city.name}/${loaderData.city.uf} — Encontre um Técnico`
      : "Técnicos por município — Encontre um Técnico";
    const description = loaderData
      ? `Veja ${loaderData.city.count} perfil(is) profissional(is) publicado(s) com cidade-base informada como ${loaderData.city.name}/${loaderData.city.uf}. Compare categorias e serviços declarados.`
      : "Encontre profissionais com cidade-base e serviços informados.";
    const canonical = loaderData
      ? `${SITE}/cidades/${loaderData.city.uf.toLowerCase()}/${loaderData.city.slug}` : `${SITE}/tecnicos`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        ...(!loaderData ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: CitySeoPage,
});

function CitySeoPage() {
  const { city, profiles, categories } = Route.useLoaderData();
  return <PageShell>
    <PublicSeoDirectory
      heading={`Técnicos em ${city.name}/${city.uf}`}
      summary={`${city.count} perfil(is) publicado(s) que informam ${city.name}/${city.uf} como cidade-base. Explore profissionais e especialidades declaradas. A cobertura fora da cidade-base depende do perfil individual.`}
      profiles={profiles} categories={categories}
    />
  </PageShell>;
}
