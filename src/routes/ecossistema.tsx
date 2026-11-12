import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import { SITE } from "@/lib/public-sitemap";

const PROJECTS = [
  {
    name: "0WEB",
    url: "https://0web.com.br/",
    area: "Marketing e presença digital",
    description: "Para profissionais e empresas que precisam apresentar serviços, fortalecer sua marca e organizar a captação de novos clientes. Conheça os projetos de marketing digital.",
  },
  {
    name: "Mestre dos Serviços",
    url: "https://www.mestredosservicos.com.br/",
    area: "Reparos, instalações e facilities",
    description: "Uma opção para conhecer soluções de manutenção residencial, comercial e predial. Consulte diretamente as condições, a região e o tipo de atendimento.",
  },
  {
    name: "Encontre um Profissional",
    url: "https://encontreumprofissional.com.br/",
    area: "Busca por categorias de serviços gerais",
    description: "Conteúdo e busca de prestadores para outras especialidades além da tecnologia, como reformas e serviços para o dia a dia.",
  },
  {
    name: "Preciso de um",
    url: "https://precisodeum.com.br/",
    area: "Plataforma de profissionais",
    description: "Conheça outra experiência de cadastro e pesquisa de prestadores de diferentes atividades. Cada portal tem suas próprias regras.",
  },
  {
    name: "Preciso de um Técnico",
    url: "https://precisodeumtecnico.com/",
    area: "Solicitação de assistência técnica",
    description: "Alternativa de atendimento técnico por triagem. Antes de solicitar, confira condições, valores e disponibilidade no próprio portal.",
  },
  {
    name: "Encontre Um",
    url: "https://encontreum.com.br/",
    area: "Serviços residenciais e comerciais",
    description: "Explore serviços complementares, desde manutenção e reparos até soluções para casa e escritório, conforme os canais próprios.",
  },
  {
    name: "Mestres dos Serviços",
    url: "https://mestresdosservicos.com.br/",
    area: "Perfil profissional",
    description: "Página de apresentação profissional e informações de atendimento. Confirme sempre as condições exibidas diretamente na plataforma.",
  },
] as const;

export const Route = createFileRoute("/ecossistema")({
  head: () => ({
    meta: [
      { title: "Ecossistema de serviços e oportunidades — Encontre um Técnico" },
      { name: "description", content: "Conheça iniciativas relacionadas para procurar serviços, valorizar profissionais e melhorar a presença digital de prestadores." },
      { property: "og:title", content: "Ecossistema de serviços e profissionais" },
      { property: "og:description", content: "Diferentes caminhos para encontrar serviços e fortalecer a atuação de profissionais e empresas." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE + "/ecossistema" },
    ],
    links: [{ rel: "canonical", href: SITE + "/ecossistema" }],
  }),
  component: EcosystemPage,
});

function EcosystemPage() {
  return (
    <PageShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <nav aria-label="Caminho de navegação" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:underline">Início</Link> / Ecossistema
        </nav>
        <header className="mt-6 max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[.17em] text-primary">Conhecimento · Profissionais · Oportunidades</p>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground sm:text-4xl">Um ecossistema para valorizar o trabalho profissional</h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Profissionais precisam de visibilidade, clientes precisam de informações claras e os serviços
            precisam ser apresentados com transparência. Estas iniciativas têm propósitos diferentes:
            diretórios especializados, serviços complementares e ferramentas de presença digital.
            Escolha o caminho que realmente ajuda na sua necessidade.
          </p>
        </header>
        <ul className="mt-9 grid gap-4 md:grid-cols-2">
          {PROJECTS.map((project) => (
            <li key={project.url} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-[.13em] text-primary">{project.area}</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">{project.name}</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">{project.description}</p>
              <a href={project.url} target="_blank" rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline">
                Conhecer {project.name} →
              </a>
            </li>
          ))}
        </ul>
        <section className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground">É profissional e quer ampliar sua presença?</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            No Encontre um Técnico, o cadastro é gratuito e o profissional descreve as especialidades
            e regiões que efetivamente atende. Não cobramos mensalidade ao técnico nem apresentamos
            o cadastro como uma certificação. O contato privado não fica exposto na galeria.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/entrar" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Cadastrar meu perfil →</Link>
            <Link to="/guias" className="inline-flex min-h-12 items-center rounded-xl border border-primary/30 px-5 text-sm font-bold text-primary">Explorar conteúdos úteis</Link>
          </div>
        </section>
        <p className="mt-6 text-xs leading-6 text-muted-foreground">
          Cada domínio mantém condições, políticas, cadastros, preços e formas próprias de atendimento.
          Esta apresentação não equivale a endosso ou garantia de profissionais, disponibilidade ou qualidade.
          O portal Encontre um Técnico não compartilha automaticamente os dados pessoais de clientes com outros sites.
        </p>
      </main>
    </PageShell>
  );
}
