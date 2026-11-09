import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — Encontre um Técnico" },
      { name: "description", content: "Cadastro gratuito, busca por região e serviço, acesso controlado ao contato e contratação direta com prestadores independentes." },
      { property: "og:title", content: "Como funciona — Encontre um Técnico" },
      { property: "og:description", content: "Cadastre-se gratuitamente ou encontre um profissional. Sem verificação técnica ou intermediação de orçamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Transparência em primeiro lugar</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Como funciona o Encontre um Técnico</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          O cliente encontra profissionais cadastrados livremente. O técnico participa sem custo.
          A negociação, o orçamento e o serviço são combinados diretamente entre eles.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-card-foreground">Para quem procura um técnico</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
              <li>Pesquise por categoria, serviço e localização: UF, cidade e bairro.</li>
              <li>Consulte os dados públicos declarados pelo profissional; não há certificação técnica do portal.</li>
              <li>Quando o acesso pago estiver operacional, confira o valor e as condições antes de adquirir um contato privado.</li>
              <li>Fale com o profissional e negocie diretamente orçamento, prazo e execução.</li>
              <li>Se não houver prestador, poderá solicitar apoio na localização de alternativas após adquirir a conveniência oferecida.</li>
            </ol>
            <Link to="/tecnicos" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
              Buscar técnico
            </Link>
          </article>
          <article className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-card-foreground">Para quem oferece serviços</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
              <li>Crie uma conta gratuitamente e indique suas especialidades reais.</li>
              <li>Preencha o nome público, a área de atendimento, UF, cidade e bairro.</li>
              <li>Informe disponibilidade e mantenha os contatos atualizados. As condições operacionais de exibição podem ocultar cadastros incompletos.</li>
              <li>Quando disponibilizadas, missões de atividade e convites por referência poderão influenciar a exibição, sem garantia de ranking ou contratação.</li>
              <li>Receba o interesse do cliente e negocie diretamente. O técnico não paga taxas de cadastro ou mensalidade.</li>
            </ol>
            <Link to="/entrar" className="mt-6 inline-flex min-h-11 items-center rounded-md border border-primary px-5 text-sm font-semibold text-primary">
              Cadastrar-me gratuitamente
            </Link>
          </article>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Durante 9h–18h</p>
            <p className="mt-2 text-2xl font-bold text-foreground">R$ 9,99</p>
            <p className="mt-1 text-xs text-muted-foreground">Conveniência de acesso ao contato, quando a compra estiver disponível.</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fora do horário</p>
            <p className="mt-2 text-2xl font-bold text-foreground">R$ 29,99</p>
            <p className="mt-1 text-xs text-muted-foreground">O preço final e o horário aplicado devem aparecer antes do pagamento.</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Para prestadores</p>
            <p className="mt-2 text-2xl font-bold text-foreground">R$ 0,00</p>
            <p className="mt-1 text-xs text-muted-foreground">Cadastro livre e gratuito, sem leilão de menor preço.</p>
          </div>
        </div>
        <div className="mt-7 rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-base font-semibold text-card-foreground">O que significa aparecer no portal?</h2>
          <p className="mt-2">A presença no diretório não corresponde a avaliação, verificação, certificação ou garantia de serviços. Informações de disponibilidade são declaradas pelos participantes.</p>
          <p className="mt-3">Leia as <Link to="/termos" className="font-medium text-primary underline">condições de uso</Link>, a <Link to="/privacidade" className="font-medium text-primary underline">política de privacidade</Link> e as <Link to="/pagamentos-e-reembolsos" className="font-medium text-primary underline">regras de pagamento e reembolso</Link>.</p>
        </div>
      </section>
    </PageShell>
  );
}
