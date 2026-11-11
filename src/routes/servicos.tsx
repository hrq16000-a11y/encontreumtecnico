import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";

const SERVICES = [
  { slug: "climatizacao", name: "Climatização", description: "Instalação e manutenção de ar-condicionado. Informe o modelo, a necessidade e o ambiente de atendimento." },
  { slug: "automacao", name: "Automação", description: "Sensores, controles e automação residencial ou comercial. Descreva os dispositivos e a integração desejada." },
  { slug: "cftv", name: "Câmeras e segurança eletrônica", description: "Instalação de câmeras, gravadores, monitoramento e configuração de acesso remoto." },
  { slug: "computadores", name: "Computadores e notebooks", description: "Diagnóstico, montagem, atualização e reparos. Informe os sintomas e os equipamentos." },
  { slug: "comunicacoes", name: "Comunicações e telefonia", description: "Interfonia e telefonia IP. Consulte os serviços específicos informados pelo prestador." },
  { slug: "eletrica", name: "Elétrica", description: "Instalações e reparos elétricos. Confirme a habilitação técnica adequada antes de contratar." },
  { slug: "design-grafico", name: "Serviços gráficos", description: "Artes e serviços gráficos. Confira o escopo declarado por cada profissional." },
  { slug: "impressoras", name: "Impressoras", description: "Configuração de impressoras, rede e manutenção. Informe a marca, o modelo e a falha." },
  { slug: "redes", name: "Redes e conectividade", description: "Configuração de Wi-Fi, roteadores e rede cabeada. Explique o ambiente e os pontos afetados." },
  { slug: "software", name: "Sistemas e software", description: "Instalação de programas, backup, formatação e limpeza de vírus. Proteja dados importantes antes da intervenção." },
];

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços e especialidades técnicas — Encontre um Técnico" },
      { name: "description", content: "Explore dez categorias de serviços técnicos e filtre profissionais por especialidade, cidade e região. Contatos privados continuam protegidos." },
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
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Serviços e especialidades técnicas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma categoria para abrir a busca já filtrada. Confira os serviços e cidades declarados pelos profissionais;
          a plataforma não certifica a habilitação técnica nem garante disponibilidade.
        </p>
        <SponsoredPublicSlot slotKey="services.content_1" routePath="/servicos" />
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <li key={service.slug} className="flex flex-col rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-card-foreground">{service.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{service.description}</p>
              <Link
                to="/tecnicos"
                search={{ especialidade: service.slug, cidade: "", regiao: "" }}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                Encontrar técnicos desta especialidade →
              </Link>
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
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não sabe qual especialidade escolher?{" "}
          <Link to="/tecnicos" search={{ especialidade: "Todas", cidade: "", regiao: "" }}
            className="font-semibold text-primary underline-offset-4 hover:underline">
            Veja todos os perfis publicados
          </Link>.
        </p>
      </section>
    </PageShell>
  );
}
