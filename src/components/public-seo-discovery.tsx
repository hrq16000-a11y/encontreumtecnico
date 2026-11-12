import { MapPin, Network, Wrench } from "lucide-react";
import {
  categoryGraphPath, cityGraphPath, type GraphCategory, type GraphCity,
  type GraphProfile, type RelatedGraphProfile,
} from "@/lib/public-seo-graph";

export type PublicSeoLinks = {
  city: GraphCity | null;
  categories: GraphCategory[];
  related: RelatedGraphProfile[];
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
      Relações baseadas em municípios, categorias ou serviços declarados. Não representam recomendações, certificações ou disponibilidade confirmada.
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
            className="block min-h-20 rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
            <span className="block font-semibold text-primary">{other.display_name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {other.city}{other.state_uf ? `/${other.state_uf}` : ""} · {other.relation}
            </span>
          </a>
        </li>)}
      </ul>
    </div>}
  </section>;
}

export function PublicSeoDirectory({
  heading, summary, profiles, cities = [], categories = [],
}: {
  heading: string;
  summary: string;
  profiles: GraphProfile[];
  cities?: GraphCity[];
  categories?: GraphCategory[];
}) {
  return <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
    <nav aria-label="Caminho de navegação" className="text-sm text-muted-foreground">
      <a href="/" className="hover:text-primary">Início</a>
      <span aria-hidden="true"> / </span>
      <a href="/tecnicos" className="hover:text-primary">Buscar técnicos</a>
    </nav>
    <header className="mt-5 rounded-3xl border border-primary/15 bg-accent/50 p-6 sm:p-9">
      <h1 className="text-2xl font-extrabold text-foreground sm:text-4xl">{heading}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{summary}</p>
      <p className="mt-3 text-xs text-muted-foreground">Perfis profissionais aprovados para publicação; as áreas e localidades são informadas pelos cadastrados. O portal não certifica qualificação ou disponibilidade.</p>
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
    <section aria-labelledby="resultados-publicos" className="mt-8">
      <h2 id="resultados-publicos" className="text-xl font-bold text-foreground">Profissionais nesta seleção</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map(profile => <li key={profile.public_slug}>
          <a href={`/tecnicos/${profile.public_slug}`}
            className="block h-full min-h-32 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/30">
            <span className="block text-lg font-bold text-primary">{profile.display_name}</span>
            <span className="mt-2 block text-sm text-muted-foreground">{profile.city}{profile.state_uf ? `/${profile.state_uf}` : ""}</span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {(profile.specialties ?? []).slice(0, 3).join(" · ") || "Perfil profissional publicado"}
            </span>
          </a>
        </li>)}
      </ul>
    </section>
    <div className="mt-7 text-sm text-muted-foreground">
      Não encontrou a especialidade desejada? <a href="/tecnicos" className="font-semibold text-primary underline">Amplie sua busca no diretório.</a>
    </div>
  </div>;
}
