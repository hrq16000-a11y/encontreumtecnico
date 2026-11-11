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
    { icon: MapPin, title: "Busca por região e especialidade", text: "O cliente procura profissionais na sua cidade e confirma diretamente a disponibilidade para atendimento." },
    { icon: Network, title: "Cadastro gratuito, autonomia de verdade", text: "Sem mensalidade para o técnico e sem disputa por quem cobra menos. Cada profissional mantém sua independência." },
    { icon: Target, title: "Negociação direta", text: "O técnico define orçamento, agenda e condições com o cliente. O portal não promete quantidade de chamados." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Valorização dos profissionais de tecnologia</p>
      <h2 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">Seu trabalho tem valor. Aqui não somos leilão!</h2>
      <p className="mt-3 max-w-[70ch] text-muted-foreground">
        O Encontre um Técnico aproxima clientes e profissionais independentes de todo o Brasil.
        Nada de disputar o menor lance: valorizamos conhecimento, experiência e negociação direta.
      </p>
      <div className="mt-5 max-w-3xl rounded-2xl border border-primary/25 bg-primary/5 p-5">
        <p className="text-lg font-bold text-foreground">Atendimento técnico: referência mínima sugerida de R$ 150 por até 1 hora.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          É uma orientação de valorização, não preço fixado pela plataforma.
          Cada profissional combina diretamente seu orçamento com o cliente; deslocamento, urgência,
          peças, complexidade e tempo adicional podem alterar o valor final.
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link to="/cadastro" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90">
          Sou técnico — quero me cadastrar gratuitamente
        </Link>
        <Link to="/tecnicos" search={ALL} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary/30 bg-card px-5 text-center text-sm font-semibold text-foreground hover:bg-accent">
          Sou cliente — encontrar profissionais
        </Link>
      </div>
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
        <p className="max-w-2xl text-lg font-bold text-primary-foreground">Encontre um Técnico: profissionais por serviço e região, sem leilão de menor preço.</p>
        <Link to="/tecnicos" search={ALL} className="inline-flex min-h-11 items-center rounded-full bg-background px-6 text-sm font-medium text-foreground hover:bg-muted">
          Encontrar técnicos
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
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Valorização do técnico e respeito ao cliente</h2>
      <p className="mt-2 text-muted-foreground">Uma rede nacional em construção, com cadastro livre e contratação direta: competência não se mede pelo menor lance.</p>
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
