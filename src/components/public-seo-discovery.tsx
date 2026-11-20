import { ArrowUpRight, MapPin, Network, Search, Wrench } from "lucide-react";
import { AdSensePublicUnit } from "@/components/adsense-public-unit";
import { TechnicianAvatar } from "@/components/technician-avatar";
import { getEnrichedServiceCategory } from "@/lib/service-catalog";
import {
  categoryGraphPath, cityGraphPath, type GraphCategory, type GraphCity,
  type GraphProfile, type RelatedGraphProfile,
} from "@/lib/public-seo-graph";

export type PublicSeoLinks = {
  city: GraphCity | null;
  categories: GraphCategory[];
  related: RelatedGraphProfile[];
};

/** Practical editorial prompts, not claims that a service is offered in a particular city. */
const SERVICE_REQUEST_NOTES: Record<string, string> = {
  climatizacao: "Informe o modelo do ar-condicionado, a dimensão aproximada do ambiente e se há ruído, gotejamento ou falha no resfriamento. Não abra o circuito de refrigeração para investigar.",
  automacao: "Liste os ambientes, os dispositivos já instalados e a função que deseja automatizar. Pergunte sobre compatibilidade, acesso remoto e controle quando a internet falhar.",
  cftv: "Descreva os pontos a monitorar e se já existe gravador ou cabeamento. Combine previamente limites de captação de imagens, armazenamento e quem terá acesso às gravações.",
  computadores: "Anote marca, modelo e comportamento do equipamento, inclusive mensagens de erro. Avise se há arquivos importantes e peça avaliação antes de autorizar formatação ou troca de disco.",
  comunicacoes: "Identifique quantos ramais, interfones ou aparelhos precisam funcionar e qual estrutura já existe. Solicite a confirmação de compatibilidade antes da instalação.",
  eletrica: "Descreva os pontos afetados e quando a falha ocorre, sem desmontar tomadas ou quadros. Para intervenções elétricas, confirme a habilitação adequada e interrompa o uso diante de sinais de risco.",
  "design-grafico": "Separe formato, medidas, finalidade e exemplos de referência autorizados. Combine revisões, arquivos finais e direitos de uso antes de aprovar o serviço.",
  impressoras: "Informe marca, modelo, conexão utilizada e mensagem de erro. Descreva se o defeito afeta impressão, digitalização ou apenas um computador da rede.",
  redes: "Anote os ambientes sem sinal, os aparelhos afetados e o modelo do roteador. Diferencie queda da internet de falha de cobertura interna antes de pedir um orçamento.",
  software: "Explique qual programa ou sistema apresenta erro e quando começou. Verifique a existência de cópia de segurança e não compartilhe senhas ou códigos de autenticação no pedido.",
};

/** Real, contextual HTML anchors, not JavaScript-only links or manufactured testimonials. */
export function PublicProfileConnections({ links }: { links?: PublicSeoLinks | undefined }) {
  if (!links || (!links.city && !links.categories.length && !links.related.length)) return null;
  return <section aria-labelledby="tecnicos-relacionados" className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
    <div className="flex items-center gap-2">
      <Network className="h-5 w-5 text-primary" aria-hidden="true" />
      <h2 id="tecnicos-relacionados" className="text-xl font-bold text-foreground">Explore técnicos relacionados</h2>
    </div>
    <p className="mt-2 text-sm text-muted-foreground">
      {links.city && <>Se você precisa de uma visita, consulte os <a href={cityGraphPath(links.city)} className="font-semibold text-primary underline underline-offset-2">técnicos de {links.city.name}/{links.city.uf}</a> e confirme se atendem ao seu bairro. </>}
      {links.categories[0] && <>Para comparar profissionais de <a href={categoryGraphPath(links.categories[0])} className="font-semibold text-primary underline underline-offset-2">{links.categories[0].label}</a>, descreva o equipamento, o sintoma e quando começou. </>}
      Antes de combinar valores, confira <a href="/como-funciona" className="font-semibold text-primary underline underline-offset-2">como funciona o contato com o profissional</a>.
    </p>
    <nav aria-label="Cidade e categorias deste técnico" className="mt-4 flex flex-wrap gap-2">
      {links.city && <a href={cityGraphPath(links.city)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 text-sm font-semibold text-primary hover:bg-primary/10">
        <MapPin className="h-4 w-4" aria-hidden="true" /> Técnicos de {links.city.name}/{links.city.uf}
      </a>}
      {links.categories.map(category => <a key={category.slug} href={categoryGraphPath(category)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-accent">
        <Wrench className="h-4 w-4" aria-hidden="true" /> {category.label}
      </a>)}
    </nav>
    {links.related.length > 0 && <div className="mt-6">
      <h3 className="font-semibold text-foreground">Outros perfis com informações em comum</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {links.related.map((other) => <li key={other.public_slug}>
          <a href={`/tecnicos/${other.public_slug}`}
            className="group flex min-h-24 items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <TechnicianAvatar name={other.display_name} avatarPath={other.avatar_path} className="h-14 w-14 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold text-primary">{other.display_name}</span>
              <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                {other.city}{other.state_uf ? `/${other.state_uf}` : ""} · {other.relation}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
          </a>
        </li>)}
      </ul>
    </div>}
  </section>;
}

export function PublicSeoDirectory({
  heading, summary, context = { kind: "category", label: heading }, profiles, cities = [], categories = [],
}: {
  heading: string;
  summary: string;
  context?: { kind: "city" | "category"; label: string; slug?: string };
  profiles: GraphProfile[];
  cities?: GraphCity[];
  categories?: GraphCategory[];
}) {
  const categoryLabels = new Map(categories.map(category => [category.slug, category.label]));
  const editorialCategories = (context.kind === "city" ? categories : context.slug
    ? [{ slug: context.slug, label: context.label }] : [])
    .flatMap(category => {
      const entry = getEnrichedServiceCategory(category.slug);
      const note = SERVICE_REQUEST_NOTES[category.slug];
      return entry && note ? [{ slug: category.slug, name: entry.category.name, note }] : [];
    }).slice(0, 3);
  const questions = context.kind === "city" ? [
    {
      question: `Quais serviços encontro em ${context.label}?`,
      answer: "As categorias acima são declaradas pelos profissionais com perfil público nesta cidade-base. Abra cada perfil para conferir as especialidades e os serviços informados.",
    },
    {
      question: `Os técnicos atendem fora de ${context.label}?`,
      answer: "A cidade-base não confirma a área de atendimento. Consulte a cobertura descrita no perfil de cada técnico antes de solicitar ajuda.",
    },
  ] : [
    {
      question: `Como encontrar um profissional de ${context.label}?`,
      answer: "Compare as localidades e os serviços declarados nos perfis abaixo. Os links de municípios mostram onde há profissionais cadastrados nesta categoria.",
    },
    {
      question: `Ter perfil em ${context.label} comprova qualificação?`,
      answer: "Não. A categoria é informada no cadastro; verifique a experiência e os detalhes do profissional no perfil antes de escolher.",
    },
  ];
  return <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
    <nav aria-label="Caminho de navegação" className="text-sm text-muted-foreground">
      <a href="/" className="hover:text-primary">Início</a>
      <span aria-hidden="true"> / </span>
      <a href="/tecnicos" className="hover:text-primary">Buscar técnicos</a>
      <span aria-hidden="true"> / </span>
      <span aria-current="page" className="text-foreground">{context.label}</span>
    </nav>
    <header className="mt-5 rounded-3xl border border-primary/15 bg-gradient-to-br from-accent/70 via-background to-primary/5 p-6 sm:p-9">
      <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
        {context.kind === "city" ? <MapPin className="h-4 w-4" aria-hidden="true" /> : <Wrench className="h-4 w-4" aria-hidden="true" />}
        {context.kind === "city" ? "Diretório por município" : "Diretório por especialidade"}
      </p>
      <h1 className="text-2xl font-extrabold text-foreground sm:text-4xl">{heading}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{summary}</p>
      <p className="mt-3 text-xs text-muted-foreground">{profiles[0] && <>Abra o perfil de <a href={`/tecnicos/${profiles[0].public_slug}`} className="font-semibold text-primary underline underline-offset-2">{profiles[0].display_name}</a> para conferir os serviços declarados. </>}
        {cities[0] && <>Se o atendimento for presencial em {cities[0].name}, compare também os <a href={cityGraphPath(cities[0])} className="font-semibold text-primary underline underline-offset-2">profissionais desse município</a>. </>}
        {categories[0] && <>Quem procura ajuda com <a href={categoryGraphPath(categories[0])} className="font-semibold text-primary underline underline-offset-2">{categories[0].label}</a> pode consultar os perfis dessa especialidade. </>}
        Ao pedir um orçamento, informe o bairro e pergunte se o valor inclui a visita e o diagnóstico.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/tecnicos" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Search className="h-4 w-4" aria-hidden="true" /> Explorar todos os técnicos
        </a>
        <a href="/contato" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 bg-background px-5 py-2 text-sm font-semibold text-primary hover:bg-accent">
          Pedir ajuda <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </header>
    {categories.length > 0 && <nav aria-label="Outras categorias nesta localização" className="mt-6">
      <h2 className="font-semibold text-foreground">Categorias presentes</h2>
      <ul className="mt-3 flex flex-wrap gap-2">{categories.map(c => <li key={c.slug}>
        <a href={categoryGraphPath(c)} className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm text-primary hover:bg-accent">{c.label}</a>
      </li>)}</ul>
    </nav>}
    {cities.length > 0 && <nav aria-label="Municípios com profissionais nesta categoria" className="mt-6">
      <h2 className="font-semibold text-foreground">Municípios com profissionais nesta categoria</h2>
      <ul className="mt-3 flex flex-wrap gap-2">{cities.map(c => <li key={cityGraphPath(c)}>
        <a href={cityGraphPath(c)} className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-sm text-primary hover:bg-accent">{c.name}/{c.uf}</a>
      </li>)}</ul>
    </nav>}
    {editorialCategories.length > 0 && <section aria-labelledby="orientacoes-diretorio" className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <h2 id="orientacoes-diretorio" className="text-xl font-bold text-foreground">
        {context.kind === "city" ? `Como preparar um pedido de serviço em ${context.label}` : `Como preparar um pedido de ${context.label}`}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {context.kind === "city"
          ? "Comece pela necessidade, não apenas pelo nome da especialidade. Os temas a seguir correspondem a categorias declaradas nos perfis públicos desta cidade-base; não garantem atendimento no seu endereço."
          : "Descreva o problema e o equipamento antes de comparar propostas. A especialidade é declarada no cadastro e não substitui a verificação de experiência, habilitação ou disponibilidade."}
      </p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {editorialCategories.map(({ slug, name, note }) => <li key={slug} className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold text-foreground">{name}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
          <a href={`/servicos/${slug}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2">
            Ler orientações completas sobre {name} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </li>)}
      </ul>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Os textos são orientações gerais para preparar a conversa; consulte o perfil para verificar os serviços efetivamente declarados por cada profissional.</p>
    </section>}
    <section aria-labelledby="resultados-publicos" className="mt-8">
      <h2 id="resultados-publicos" className="text-xl font-bold text-foreground">Conheça os profissionais</h2>
      <p className="mt-2 text-sm text-muted-foreground">Fotos adicionadas pelos próprios técnicos quando disponíveis; caso contrário, mostramos apenas as iniciais.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map(profile => <li key={profile.public_slug}>
          <a href={`/tecnicos/${profile.public_slug}`}
            className="group flex h-full min-h-40 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span className="flex items-start gap-3">
              <TechnicianAvatar name={profile.display_name} avatarPath={profile.avatar_path} className="h-14 w-14" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-lg font-bold text-primary">{profile.display_name}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {profile.city}{profile.state_uf ? `/${profile.state_uf}` : ""}
                </span>
              </span>
            </span>
            <span className="mt-4 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {(context.kind === "category" ? [context.label] : (profile.specialties ?? [])
                .map(slug => categoryLabels.get(slug)).filter((label): label is string => !!label))
                .slice(0, 3).map(label => <span key={label} className="rounded-full bg-accent px-2.5 py-1 text-foreground">{label}</span>)}
            </span>
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">
              Conhecer perfil <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </a>
        </li>)}
      </ul>
    </section>
    <AdSensePublicUnit />
    <section aria-labelledby="duvidas-diretorio" className="mt-10 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <h2 id="duvidas-diretorio" className="text-xl font-bold text-foreground">Dúvidas para escolher com segurança</h2>
      <div className="mt-4 divide-y divide-border">
        {questions.map(({ question, answer }) => <details key={question} className="group py-4 first:pt-0 last:pb-0">
          <summary className="cursor-pointer font-semibold text-foreground marker:text-primary">{question}</summary>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
        </details>)}
      </div>
    </section>
    <div className="mt-7 text-sm text-muted-foreground">
      Não encontrou a especialidade desejada? <a href="/tecnicos" className="font-semibold text-primary underline">Amplie sua busca no diretório.</a>
    </div>
  </div>;
}
