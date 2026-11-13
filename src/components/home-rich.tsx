import { Link } from "@tanstack/react-router";
import {
  AirVent,
  ArrowRight,
  CircuitBoard,
  Cctv,
  ClipboardCheck,
  Laptop,
  MapPinned,
  Newspaper,
  Headset,
  TicketCheck,
  Printer,
  RadioTower,
  Search,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { FAQ } from "../lib/faq";
import { openFreeHelp, portalHelpContext } from "@/lib/free-search-help";
import { SectionHeading } from "./motion";
import { NationalCoverage } from "./national-coverage";

const ALL = { especialidade: "Todas", cidade: "", regiao: "" };

type Icon = typeof Cctv;

const CATEGORY_INFO: Record<string, { icon: Icon; text: string }> = {
  climatizacao: { icon: AirVent, text: "Instalação, limpeza e manutenção de split e janela." },
  automacao: { icon: CircuitBoard, text: "Automação residencial e predial, sensores e cenários." },
  cftv: { icon: Cctv, text: "Câmeras, gravadores e acesso remoto com segurança." },
  computadores: { icon: Laptop, text: "Manutenção, formatação, upgrade e recuperação de dados." },
  software: { icon: Laptop, text: "Instalação de sistemas, configuração e recuperação de dados." },
  comunicacoes: { icon: RadioTower, text: "Redes, cabeamento estruturado e telefonia IP." },
  redes: { icon: RadioTower, text: "Redes, cabeamento estruturado e conectividade." },
  eletrica: { icon: Zap, text: "Instalações, quadros de força e adequações elétricas." },
  "design-grafico": { icon: Newspaper, text: "Impressos, plotagens e serviços gráficos sob demanda." },
  impressoras: { icon: Printer, text: "Instalação, recarga, manutenção e impressora em rede." },
};

const REGIONS = [
  { name: "Norte", states: "AC, AP, AM, PA, RO, RR, TO" },
  { name: "Nordeste", states: "AL, BA, CE, MA, PB, PE, PI, RN, SE" },
  { name: "Centro-Oeste", states: "DF, GO, MT, MS" },
  { name: "Sudeste", states: "ES, MG, RJ, SP" },
  { name: "Sul", states: "PR, RS, SC" },
];

const APPROVAL = [
  { icon: UserCheck, title: "Cadastro", text: "O técnico cria a conta, informa especialidades, cidade e regiões que atende." },
  { icon: ClipboardCheck, title: "Perfil completo", text: "O prestador informa os dados e serviços reais que deseja divulgar." },
  { icon: ShieldCheck, title: "Regras operacionais", text: "A exibição depende de dados e controles da plataforma, não de avaliação técnica." },
  { icon: Search, title: "Busca", text: "O cliente encontra o profissional por especialidade, cidade ou região." },
];

export function CategoryGrid() {
  const { categories } = useActiveCategories();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading
        eyebrow="Categorias"
        title="Categorias de atividades populares"
        text="Escolha uma área e conheça os profissionais com cadastro disponível nessa categoria."
      />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const info = CATEGORY_INFO[category.slug] ?? { icon: Cctv, text: "" };
          const I = info.icon;
          return (
            <li key={category.slug}>
              <Link
                to="/tecnicos"
                search={{ especialidade: category.slug, cidade: "", regiao: "" }}
                onClick={() =>
                  window.__lovableEvents?.track?.("project.category_selected", { category: category.slug })
                }
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-soft"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <I className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-card-foreground">{category.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{category.description || info.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                  Ver técnicos <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HowItWorksRich() {
  const steps: { icon: Icon; title: string; text: string }[] = [
    { icon: Search, title: "Busque", text: "Pesquise por especialidade, cidade ou região — ou descreva o problema e deixe a sugestão de filtro com a IA." },
    { icon: ShieldCheck, title: "Escolha", text: "Compare informações declaradas pelo prestador e confira diretamente a disponibilidade." },
    { icon: ClipboardCheck, title: "Solicite", text: "Abra uma solicitação de atendimento e acompanhe o histórico e o status." },
  ];
  return (
    <section className="border-t border-border bg-muted/40 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Como funciona"
          title="Do problema ao atendimento em três passos"
          text="Sem leilão de preço e sem taxa para o profissional: o cliente encontra, o técnico é valorizado."
        />
        <ol className="relative mt-10 grid gap-6 md:grid-cols-3">
          <span
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block"
          />
          {steps.map(({ icon: I, title, text }, i) => (
            <li key={title} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                <I className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Passo {i + 1}
              </p>
              <h3 className="mt-1 font-semibold text-card-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function CoverageSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading
        eyebrow="Cobertura"
        title="Busque por região ou pela sua cidade"
        text="Busque prestadores por região e serviço. Caso ainda não encontre alguém, consulte as opções de ajuda e disponibilidade da plataforma."
      />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {REGIONS.map(({ name, states }) => (
          <li key={name}>
            <Link
              to="/tecnicos"
              search={{ especialidade: "Todas", cidade: "", regiao: name }}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-soft"
            >
              <span className="flex items-center gap-2 font-semibold text-card-foreground">
                <MapPinned className="h-4 w-4 text-primary" aria-hidden />
                {name}
              </span>
              <span className="mt-2 text-xs leading-relaxed text-muted-foreground">{states}</span>
            </Link>
          </li>
        ))}
      </ul>
      <NationalCoverage />
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Prefere procurar por cidade?</span>
        <Link
          to="/tecnicos"
          search={ALL}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 font-medium text-foreground hover:border-primary hover:text-primary"
        >
          <Search className="h-4 w-4" aria-hidden /> Buscar por cidade
        </Link>
      </div>
    </section>
  );
}

export function ApprovalProcessSection() {
  return (
    <section className="bg-brand-navy px-4 py-16 text-brand-navy-foreground">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          tone="dark"
          align="center"
          eyebrow="Transparência"
          title="Como um perfil chega até você"
          text="O cadastro é livre. Visibilidade não significa verificação, certificação ou garantia técnica."
        />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {APPROVAL.map(({ icon: I, title, text }, i) => (
            <li
              key={title}
              className="rounded-2xl border border-brand-glow/20 bg-white/5 p-6 backdrop-blur-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-glow/15 text-brand-glow">
                <I className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 font-semibold">{title}</h3>
              <p className="mt-1 text-sm opacity-80">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FaqPreview() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading
        eyebrow="Dúvidas frequentes"
        title="O que os clientes mais perguntam"
        text="Respostas rápidas. A lista completa está na página de perguntas frequentes."
      />
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {FAQ.slice(0, 4).map((item) => (
          <li key={item.q} className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-card-foreground">{item.q}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
          </li>
        ))}
      </ul>
      <Link
        to="/faq"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
      >
        Ver todas as perguntas <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

export function ContactBand() {
  return (
    <section className="px-4 py-16">
      <div className="relative isolate mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[28px] border border-brand-glow/25 bg-brand-navy p-7 text-brand-navy-foreground shadow-[0_28px_70px_-28px_rgba(5,20,44,.65)] md:grid-cols-[1.2fr_1fr] md:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand-glow/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-glow/30 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-navy-foreground">
            <Headset className="h-4 w-4" aria-hidden="true" /> Atendimento guiado
          </span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Precisa de ajuda do portal?</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 sm:text-base">
            Dúvidas de cadastro, acesso ou solicitações? Conte o que aconteceu no nosso fluxo seguro.
            A equipe recebe o pedido com o contexto da página inicial.
          </p>
          <button type="button" onClick={() => openFreeHelp(portalHelpContext("home"))}
            className="group mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-brand-navy shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transform-none">
            <Headset className="h-5 w-5" aria-hidden="true" />
            Pedir ajuda ao portal
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
          </button>
          <p className="mt-3 text-xs text-white/70">Um único caminho: pedido registrado antes de oferecer WhatsApp. Sem telefone público.</p>
        </div>
        <ul className="relative grid gap-3 text-sm text-white/90">
          <li className="eut-card-lift flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4">
            <Headset className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" aria-hidden="true" />
            <span><strong className="block text-white">Orientação pela equipe</strong>Escolha o assunto e descreva sua necessidade.</span>
          </li>
          <li className="eut-card-lift flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4">
            <TicketCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" aria-hidden="true" />
            <span><strong className="block text-white">Solicitação registrada</strong>O registro acontece antes do encaminhamento ao WhatsApp.</span>
          </li>
          <li className="eut-card-lift flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" aria-hidden="true" />
            <span><strong className="block text-white">Contatos protegidos</strong>O portal não divulga telefones de técnicos livremente.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
