import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "../components/page-placeholder";
import { SponsoredPublicSlot } from "@/components/sponsored-public-slot";

// Only categories backed by the active official portal taxonomy.
// Each link opens the live, filtered directory; no invented local landing pages.
const SERVICES = [
  { slug: "climatizacao", name: "Climatização", description: "Instalação, manutenção e limpeza de ar-condicionado. Descreva o equipamento e o tipo de serviço necessário." },
  { slug: "automacao", name: "Automação", description: "Automação residencial e comercial, sensores, integração de dispositivos e controles." },
  { slug: "cftv", name: "Câmeras e segurança eletrônica", description: "Câmeras, gravadores, monitoramento e configuração de acesso remoto. Informe o ambiente e os dispositivos." },
  { slug: "computadores", name: "Computadores e notebooks", description: "Diagnóstico, manutenção, troca de componentes e montagem. Explique o defeito antes de solicitar atendimento." },
  { slug: "comunicacoes", name: "Comunicações e telefonia", description: "Interfonia, telefonia IP e soluções de comunicação em ambientes residenciais ou comerciais." },
  { slug: "eletrica", name: "Elétrica", description: "Instalações e reparos elétricos. Confirme diretamente com o prestador a habilitação adequada ao serviço." },
  { slug: "design-grafico", name: "Serviços gráficos", description: "Criação de artes e atividades gráficas. Consulte os serviços específicos declarados pelo profissional." },
  { slug: "impressoras", name: "Impressoras", description: "Configuração, conexão em rede e manutenção de impressoras. Informe modelo e sintoma da falha." },
  { slug: "redes", name: "Redes e conectividade", description: "Configuração de roteadores, redes Wi-Fi e cabeamento. Informe a estrutura e o problema de conexão." },
  { slug: "software", name: "Sistemas e software", description: "Instalação de programas, formatação, backup e remoção de vírus. Proteja seus dados antes da manutenção." },
];

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços técnicos e especialidades — Encontre um Técnico" },
      { name: "description", content: "Explore dez categorias de serviços técnicos, compare perfis públicos e busque profissionais por especialidade, cidade e região." },
      { property: "og:title", content: "Serviços e especialidades — Encontre um Técnico" },
      { property: "og:description", content: "Encontre prestadores cadastrados por categoria. Confira serviços e região informados diretamente no perfil." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.encontreumtecnico.com/servicos" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://www.encontreumtecnico.com/servicos" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Serviços e especialidades técnicas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Escolha a área que corresponde à sua necessidade para abrir a busca já filtrada.
          Os serviços e localidades são declarados pelos profissionais cadastrados; o portal não certifica a habilitação técnica.
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
        <section aria-labelledby="orientacoes-para-contratar" className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
          <h2 id="orientacoes-para-contratar" className="text-xl font-bold text-foreground">Como aproveitar melhor a busca</h2>
          <ol className="mt-4 grid gap-5 text-sm leading-6 text-muted-foreground md:grid-cols-3">
            <li><strong className="block text-foreground">1. Selecione a necessidade</strong>Escolha a categoria e depois refine pelo serviço que precisa.</li>
            <li><strong className="block text-foreground">2. Confira a região declarada</strong>Revise cidade, municípios atendidos e especialidades informadas no perfil.</li>
            <li><strong className="block text-foreground">3. Descreva o problema</strong>Explique o equipamento, sintomas e urgência pelo funil. O contato privado não aparece livremente.</li>
          </ol>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            O cadastro é gratuito ao técnico. A presença em uma categoria não garante disponibilidade, qualificação ou contratação.
          </p>
        </section>
      </section>
    </PageShell>
  );
}
