import { publicTextProblem } from "@/lib/public-profile-text";
import { serviceSlug, validMunicipality } from "@/lib/service-taxonomy";

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_UF = /^[A-Z]{2}$/;

export type GraphProfile = {
  public_slug: string | null;
  display_name: string;
  city: string;
  state_uf: string | null;
  specialties: string[] | null;
  service_slugs: string[] | null;
  updated_at?: string | null;
};

export type GraphCity = {
  uf: string;
  slug: string;
  name: string;
  count: number;
  updated_at: string | null;
};
export type GraphCategory = {
  slug: string;
  label: string;
  count: number;
  updated_at: string | null;
};
export type GraphCatalog = {
  profiles: GraphProfile[];
  cities: GraphCity[];
  categories: GraphCategory[];
};

export function validGraphSlug(slug: unknown): slug is string {
  return typeof slug === "string" && slug.length <= 96 && VALID_SLUG.test(slug);
}

export function cityGraphPath(city: Pick<GraphCity, "uf" | "slug">): string {
  return `/cidades/${city.uf.toLowerCase()}/${city.slug}`;
}

export function categoryGraphPath(category: Pick<GraphCategory, "slug">): string {
  return `/categorias/${category.slug}`;
}

function isRealCity(uf: string | null, city: string): boolean {
  return validMunicipality(uf, city) && !/\b(regi[aã]o metropolitana|grande [a-z]|microrregi[aã]o)\b/iu.test(city);
}

function cityKey(uf: string | null, name: string): string {
  return `${(uf ?? "").toUpperCase()}|${serviceSlug(name)}`;
}

function lastModified(a: string | null, b: string | null): string | null {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta)) return Number.isFinite(tb) ? b : null;
  if (!Number.isFinite(tb)) return a;
  return ta >= tb ? a : b;
}

/**
 * Materialize only indexable nodes backed by live, APPROVED technician records,
 * active categories and catalog-verified IBGE municipalities.
 * Never form arbitrary (category × city × service × neighborhood) URLs.
 */
export function buildPublicGraph(
  rawProfiles: readonly GraphProfile[],
  municipalities: readonly { name: string; uf: string }[],
  activeCategories: readonly { slug: string; label: string }[],
): GraphCatalog {
  const cityCatalog = new Map<string, { name: string; uf: string }>();
  for (const city of municipalities) {
    if (VALID_UF.test(city.uf) && isRealCity(city.uf, city.name)) {
      cityCatalog.set(cityKey(city.uf, city.name), city);
    }
  }
  const categoryCatalog = new Map(
    activeCategories.filter((c) => validGraphSlug(c.slug) && c.label.trim())
      .map((c) => [c.slug, c.label] as const),
  );
  const seen = new Set<string>();
  const profiles: GraphProfile[] = [];
  const cities = new Map<string, GraphCity>();
  const categories = new Map<string, GraphCategory>();

  for (const raw of rawProfiles) {
    if (!validGraphSlug(raw.public_slug) || seen.has(raw.public_slug)) continue;
    seen.add(raw.public_slug);
    const profile: GraphProfile = {
      public_slug: raw.public_slug,
      display_name: publicTextProblem(raw.display_name, "identity")
        ? "Profissional cadastrado" : raw.display_name.trim().slice(0, 120),
      city: raw.city,
      state_uf: raw.state_uf,
      specialties: [...new Set((raw.specialties ?? []).filter(validGraphSlug))].slice(0, 40),
      service_slugs: [...new Set((raw.service_slugs ?? []).filter(validGraphSlug))].slice(0, 60),
      updated_at: raw.updated_at ?? null,
    };
    profiles.push(profile);
    const key = cityKey(profile.state_uf, profile.city);
    const knownCity = cityCatalog.get(key);
    if (knownCity && isRealCity(profile.state_uf, profile.city)) {
      const previous = cities.get(key);
      cities.set(key, {
        uf: knownCity.uf,
        name: knownCity.name,
        slug: serviceSlug(knownCity.name),
        count: (previous?.count ?? 0) + 1,
        updated_at: lastModified(previous?.updated_at ?? null, profile.updated_at ?? null),
      });
    }
    for (const slug of profile.specialties ?? []) {
      const label = categoryCatalog.get(slug);
      if (!label) continue;
      const prior = categories.get(slug);
      categories.set(slug, {
        slug, label,
        count: (prior?.count ?? 0) + 1,
        updated_at: lastModified(prior?.updated_at ?? null, profile.updated_at ?? null),
      });
    }
  }
  return {
    profiles,
    cities: [...cities.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.uf.localeCompare(b.uf)),
    categories: [...categories.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  };
}

export function profilesInCity(graph: GraphCatalog, uf: string, slug: string): GraphProfile[] {
  if (!graph.cities.some((c) => c.uf.toLowerCase() === uf.toLowerCase() && c.slug === slug)) return [];
  return graph.profiles.filter((p) =>
    p.state_uf?.toLowerCase() === uf.toLowerCase() && serviceSlug(p.city) === slug);
}

export function profilesInCategory(graph: GraphCatalog, slug: string): GraphProfile[] {
  if (!graph.categories.some((category) => category.slug === slug)) return [];
  return graph.profiles.filter((p) => (p.specialties ?? []).includes(slug));
}

export type RelatedGraphProfile = GraphProfile & { relation: string; relevance: number };

export function relatedGraphProfiles(
  graph: GraphCatalog, current: GraphProfile, limit = 6,
): RelatedGraphProfile[] {
  if (!validGraphSlug(current.public_slug)) return [];
  const ownCity = graph.cities.find((c) => cityKey(c.uf, c.name) === cityKey(current.state_uf, current.city));
  const ownCategories = new Set((current.specialties ?? []).filter((s) =>
    graph.categories.some((cat) => cat.slug === s)));
  const ownServices = new Set(current.service_slugs ?? []);
  return graph.profiles.flatMap((p) => {
    if (p.public_slug === current.public_slug) return [];
    const sameCity = !!ownCity && cityKey(p.state_uf, p.city) === cityKey(current.state_uf, current.city);
    const sharedCategories = (p.specialties ?? []).filter((s) => ownCategories.has(s)).length;
    const sharedServices = (p.service_slugs ?? []).filter((s) => ownServices.has(s)).length;
    if (!sameCity && sharedCategories === 0 && sharedServices === 0) return [];
    const relevance = (sameCity ? 10 : 0) + Math.min(sharedCategories, 3) * 4 + Math.min(sharedServices, 3) * 5;
    const relation = sameCity ? "Mesmo município" : sharedServices ? "Serviço em comum" : "Categoria em comum";
    return [{ ...p, relevance, relation }];
  }).sort((a, b) => b.relevance - a.relevance || (a.public_slug ?? "").localeCompare(b.public_slug ?? ""))
    .slice(0, Math.min(12, Math.max(0, limit)));
}
