import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { PublicSeoDirectory } from "@/components/public-seo-discovery";
import { getSeoCity } from "@/lib/public-seo-graph.functions";
import { cityGraphPath } from "@/lib/public-seo-graph";
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
      ? `Consulte ${loaderData.city.count} perfil(is) público(s) de técnicos com cidade-base em ${loaderData.city.name}/${loaderData.city.uf}. Veja especialidades, orientações para orçamento e outras cidades do estado.`
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
  const { city, profiles, categories, relatedCities } = Route.useLoaderData();
  return <PageShell>
    <PublicSeoDirectory
      heading={`Técnicos em ${city.name}/${city.uf}`}
      summary={`${city.count} perfil(is) publicado(s) que informam ${city.name}/${city.uf} como cidade-base. Explore profissionais e especialidades declaradas. A cobertura fora da cidade-base depende do perfil individual.`}
      context={{ kind: "city", label: `${city.name}/${city.uf}` }}
      profiles={profiles} categories={categories}
    />
    <section aria-labelledby="orientacoes-cidade" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        <h2 id="orientacoes-cidade" className="text-xl font-bold text-foreground">
          Como escolher atendimento técnico em {city.name}/{city.uf}
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Antes de solicitar uma visita em {city.name}, descreva a falha, informe o modelo do equipamento
          e pergunte sobre diagnóstico, deslocamento, materiais e garantia. Consulte as
          <a href="/servicos" className="mx-1 font-semibold text-primary underline underline-offset-2">áreas de serviço do portal</a>
          para identificar a especialidade adequada, e use os
          <a href="/guias" className="mx-1 font-semibold text-primary underline underline-offset-2">guias de preparação</a>
          para organizar as informações sem divulgar senhas ou documentos privados.
        </p>
        {categories[0] && <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Se o pedido está relacionado à categoria
          <a href={"/categorias/" + categories[0].slug} className="mx-1 font-semibold text-primary underline underline-offset-2">{categories[0].label}</a>
          {categories[1] && <> ou a <a href={"/categorias/" + categories[1].slug} className="font-semibold text-primary underline underline-offset-2">{categories[1].label}</a></>},
          confira os perfis que declaram essas especialidades e confirme diretamente a área de atendimento e a disponibilidade.
          Os resultados refletem cadastros públicos, não uma promessa de atendimento imediato.
        </p>}
        {relatedCities.length > 0 && <div className="mt-5 border-t border-border pt-5">
          <h3 className="font-semibold text-foreground">Outras cidades do estado com perfis públicos</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Se você também busca profissionais em outras localidades de {city.uf}, consulte
            {relatedCities.slice(0, 3).map((other, i) => <span key={cityGraphPath(other)}>
              {i === 0 ? " " : i === relatedCities.length - 1 || i === 2 ? " ou " : ", "}
              <a href={cityGraphPath(other)} className="font-semibold text-primary underline underline-offset-2">
                técnicos em {other.name}/{other.uf}
              </a>
            </span>)}.
            Essas páginas são exibidas porque há perfis públicos com a cidade-base declarada, sem pressupor deslocamento entre municípios.
          </p>
        </div>}
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          Presta serviços técnicos em {city.name} ou atende outras regiões?
          <a href="/cadastro" className="mx-1 font-semibold text-primary underline underline-offset-2">Cadastre seu perfil profissional</a>
          e informe sua cidade-base, especialidades e cobertura real. A inclusão no
          <a href="/cobertura" className="mx-1 font-semibold text-primary underline underline-offset-2">diretório nacional de cobertura</a>
          depende da publicação elegível do cadastro, não apenas do envio do formulário.
        </p>
      </div>
    </section>
  </PageShell>;
}
