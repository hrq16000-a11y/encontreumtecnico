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
  Phone,
  Printer,
  RadioTower,
  Search,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { CATEGORIES } from "../lib/categories";
import { FAQ } from "../lib/faq";
import { SectionHeading } from "./motion";

const ALL = { especialidade: "Todas", cidade: "", regiao: "" };

type Icon = typeof Cctv;

const CATEGORY_INFO: Record<string, { icon: Icon; text: string }> = {
  "Ar-condicionado": { icon: AirVent, text: "Instalação, limpeza e manutenção de split e janela." },
  Automação: { icon: CircuitBoard, text: "Automação residencial e predial, sensores e cenários." },
  CFTV: { icon: Cctv, text: "Câmeras, gravadores e acesso remoto com segurança." },
  Computador: { icon: Laptop, text: "Manutenção, formatação, upgrade e recuperação de dados." },
  Comunicações: { icon: RadioTower, text: "Redes, cabeamento estruturado e telefonia IP." },
  Elétrica: { icon: Zap, text: "Instalações, quadros de força e adequações elétricas." },
  Gráfica: { icon: Newspaper, text: "Impressos, plotagens e serviços gráficos sob demanda." },
  Impressora: { icon: Printer, text: "Instalação, recarga, manutenção e impressora em rede." },
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
  { icon: ClipboardCheck, title: "Análise", text: "A administração confere as informações informadas no perfil." },
  { icon: ShieldCheck, title: "Aprovação", text: "Só depois de aprovado o perfil entra na busca pública." },
  { icon: Search, title: "Busca", text: "O cliente encontra o profissional por especialidade, cidade ou região." },
];

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading
        eyebrow="Categorias"
        title="Categorias de atividades populares"
        text="Escolha uma área e veja os técnicos aprovados que atendem nela."
      />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => {
          const info = CATEGORY_INFO[category] ?? { icon: Cctv, text: "" };
          const I = info.icon;
          return (
            <li key={category}>
              <Link
                to="/tecnicos"
                search={{ especialidade: category, cidade: "", regiao: "" }}
                onClick={() =>
                  window.__lovableEvents?.track?.("project.category_selected", { category })
                }
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-soft"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                  <I className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-card-foreground">{category}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{info.text}</p>
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
    { icon: ShieldCheck, title: "Escolha", text: "Compare apenas perfis aprovados, com especialidades e local de atendimento claros." },
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
        text="A lista mostra somente técnicos aprovados. Ainda não encontrou ninguém na sua região? Cadastre-se como cliente e abra uma solicitação."
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
          eyebrow="Confiança"
          title="Como um perfil chega até você"
          text="Nenhum perfil aparece na busca pública antes de passar pela análise da administração."
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
      <div className="mx-auto grid max-w-6xl items-center gap-6 rounded-3xl border border-border bg-gradient-to-br from-accent via-card to-card p-8 shadow-soft md:grid-cols-[1.4fr_1fr] md:p-12">
        <div>
          <SectionHeading
            eyebrow="Atendimento"
            title="Fale com a equipe do portal"
            text="Dúvidas sobre cadastro, aprovação de perfil ou uma solicitação em andamento? A gente responde."
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/contato"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Enviar mensagem <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="tel:+5541997452053"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
            >
              <Phone className="h-4 w-4 text-primary" aria-hidden /> (41) 9 9745-2053
            </a>
          </div>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Perfis só aparecem na busca depois de aprovados.
          </li>
          <li className="flex gap-3">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Solicitações ficam registradas com histórico e status.
          </li>
          <li className="flex gap-3">
            <UserCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            O técnico não paga para participar nem por contato.
          </li>
        </ul>
      </div>
    </section>
  );
}
