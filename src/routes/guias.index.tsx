import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { GUIDES } from "@/lib/public-guides";
import { getGuideArtwork } from "@/lib/guide-artwork";
import { SITE } from "@/lib/public-sitemap";

export const Route = createFileRoute("/guias/")({
  head: () => ({
    meta: [
      { title: "Guias para contratar serviços técnicos — Encontre um Técnico" },
      { name: "description", content: "Orientações práticas para identificar problemas, preparar pedidos de manutenção e comparar serviços técnicos sem expor dados privados." },
      { property: "og:title", content: "Guias práticos de serviços técnicos — Encontre um Técnico" },
      { property: "og:description", content: "Guias práticos sobre computadores, Wi-Fi, impressoras e câmeras para preparar a solicitação de atendimento." },
      { property: "og:url", content: SITE + "/guias" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: SITE + "/guias" }],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <PageShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav aria-label="Caminho de navegação" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Início</Link> / Guias
        </nav>
        <header className="mt-6 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Central de orientação</p>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground sm:text-4xl">Guias úteis antes de chamar um técnico</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Organize os sintomas, proteja seus dados e faça perguntas melhores na hora de solicitar um orçamento.
            Os textos são orientações gerais; não representam um diagnóstico nem certificação de profissionais.
          </p>
        </header>
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {GUIDES.map((guide, index) => (
            <li key={guide.slug} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <Link to="/guias/$slug" params={{ slug: guide.slug }} className="block overflow-hidden">
                <img src={getGuideArtwork(guide.categorySlug).src}
                  alt={getGuideArtwork(guide.categorySlug).alt}
                  width={1200} height={630} loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"} decoding="async"
                  className="aspect-video w-full object-cover transition-transform duration-300 hover:scale-[1.025]" />
              </Link>
              <div className="flex flex-1 flex-col p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{guide.categoryName}</p>
              <h2 className="mt-3 text-xl font-bold leading-snug text-card-foreground">{guide.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{guide.description}</p>
              <Link
                to="/guias/$slug" params={{ slug: guide.slug }}
                className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline">
                Ler guia completo →
              </Link>
              </div>
            </li>
          ))}
        </ul>
        <section className="mt-10 rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-bold text-foreground">Já sabe qual serviço precisa?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Consulte os profissionais com perfil publicado e confirme as especialidades e a região declaradas.
            O portal não divulga contatos privados na busca.
          </p>
          <Link to="/servicos" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
            Explorar categorias de serviços →
          </Link>
        </section>
      </main>
    </PageShell>
  );
}
