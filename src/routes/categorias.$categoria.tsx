import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { PublicSeoDirectory } from "@/components/public-seo-discovery";
import { getSeoCategory } from "@/lib/public-seo-graph.functions";
import { SITE } from "@/lib/public-sitemap";

export const Route = createFileRoute("/categorias/$categoria")({
  loader: async ({ params }) => {
    const result = await getSeoCategory({ data: { category: params.categoria } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.category.label}: técnicos e regiões — Encontre um Técnico`
      : "Categorias profissionais — Encontre um Técnico";
    const description = loaderData
      ? `Consulte ${loaderData.category.count} perfil(is) público(s) que informam atuação em ${loaderData.category.label}. Explore cidades com técnicos cadastrados e perfis disponíveis.`
      : "Encontre profissionais por categoria declarada.";
    const canonical = loaderData
      ? `${SITE}/categorias/${loaderData.category.slug}` : `${SITE}/tecnicos`;
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
  component: CategorySeoPage,
});

function CategorySeoPage() {
  const { category, profiles, cities } = Route.useLoaderData();
  return <PageShell>
    <PublicSeoDirectory
      heading={`Técnicos de ${category.label}`}
      summary={`${category.count} perfil(is) publicado(s) com esta categoria declarada. Veja as cidades-base informadas e compare profissionais que oferecem serviços nesta área.`}
      profiles={profiles} cities={cities}
    />
  </PageShell>;
}
