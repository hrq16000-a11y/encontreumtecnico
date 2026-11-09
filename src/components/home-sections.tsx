import { Link } from "@tanstack/react-router";
import { Diamond, MapPin, Network, PenTool, Search, Target, UserPlus, ClipboardList } from "lucide-react";

const ALL = { especialidade: "Todas", cidade: "", regiao: "" };

export function FindOneSection() {
  return (
    <section className="bg-muted/40 px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-lg text-muted-foreground">Precisa de um Técnico?</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Uma maneira melhor de encontrar e contratar profissionais
        </h2>
        <p className="mt-3 text-4xl font-light text-primary md:text-5xl">Encontre um!</p>
        <p className="mt-3 text-base text-muted-foreground">Clientes confiantes, desafios resolvidos com excelência.</p>
        <Link to="/tecnicos" search={ALL} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium uppercase text-primary-foreground hover:bg-primary/90">
          Pesquisar técnicos
        </Link>
      </div>
    </section>
  );
}

export function JoinNetworkSection() {
  const items = [
    { icon: MapPin, title: "De acordo com sua localização", text: "A demanda chega de acordo com a sua localidade, facilitando o dia a dia para você e o cliente." },
    { icon: Network, title: "Oportunidade de networking", text: "Os atendimentos são realizados em grandes empresas de diferentes setores, gerando experiência em serviços consolidados para você obter mais expertise na sua área e ter contato com novos nichos de mercado." },
    { icon: Target, title: "Parceiro: Preciso de um Técnico", text: "Como nosso parceiro, você é integrado ao Ecossistema Ping Soluções e TomoNaWeb, que contempla uma série de soluções tecnológicas que expandem as modalidades e possibilidades de atendimento." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-2xl font-semibold text-foreground">Faça parte da melhor rede de técnicos de TI do Brasil</h2>
      <p className="mt-2 max-w-[70ch] text-muted-foreground">
        Torne-se um parceiro Preciso de um Técnico e aproveite uma oportunidade flexível de ganhos de acordo com a sua disponibilidade.
      </p>
      <ul className="mt-8 grid gap-6 md:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon className="h-7 w-7 text-primary" aria-hidden />
            <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="bg-primary px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-lg text-primary-foreground">Preciso de um Técnico, ajuda você a encontrar um técnico!</p>
        <Link to="/tecnicos" search={ALL} className="inline-flex min-h-11 items-center rounded-full bg-background px-6 text-sm font-medium text-foreground hover:bg-muted">
          Encontrar um prestador
        </Link>
      </div>
    </section>
  );
}

export function ValuesSection() {
  const items = [
    { icon: PenTool, title: "Nossos Valores", text: "Serviços de qualidade e pontuais para soluções sustentáveis por métodos automatizados e específicos." },
    { icon: Target, title: "Nossa Missão", text: "Fornecer serviços e facilidades para transformar nossa visão em realidade." },
    { icon: Diamond, title: "Nossa Visão", text: "Ser honesto e direto em tudo o que fazemos, ao mesmo tempo em que compreendemos e valorizamos as contribuições." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 text-center">
      <p className="text-sm font-medium text-primary">01. Por que usar nossa plataforma?</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Processo que ajudam a valorizar o prestador!</h2>
      <p className="mt-2 text-muted-foreground">Use e ajude a divulgar a nossa plataforma em prol da valorização dos prestadores e não pelo menor preço.</p>
      <ul className="mt-10 grid gap-8 md:grid-cols-3">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col items-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-card shadow-md">
              <Icon className="h-10 w-10 text-primary" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StepsSection() {
  const steps = [
    { icon: UserPlus, title: "Crie uma conta!", cta: "Inscrever-se" },
    { icon: ClipboardList, title: "Faça seu perfil", cta: "Preencher" },
    { icon: Search, title: "Capriche nos detalhes", cta: "Seja encontrado!" },
  ];
  return (
    <section className="bg-muted/40 px-4 py-16 text-center">
      <h2 className="text-3xl font-semibold text-foreground">Passos para ser encontrado</h2>
      <ol className="mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, cta }) => (
          <li key={title} className="flex flex-col items-center">
            <span className="flex h-32 w-32 items-center justify-center rounded-[2.5rem] border-8 border-primary bg-card">
              <Icon className="h-12 w-12 text-primary" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3>
            <Link to="/entrar" className="mt-3 inline-flex min-h-11 items-center rounded-full border border-primary px-5 text-sm text-primary hover:bg-primary/5">
              {cta}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
