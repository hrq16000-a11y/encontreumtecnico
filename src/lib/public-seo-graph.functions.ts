import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPublicGraph, profilesInCategory, profilesInCity, relatedGraphProfiles,
  validGraphSlug, type GraphCatalog, type GraphProfile,
} from "@/lib/public-seo-graph";

const BATCH = 500;
const MAX_PROFILE_PAGES = 20; // >10,000 approved profiles requires a sitemap-index rollout.
const MUNICIPALITY_BATCH = 1000;
const MAX_MUNICIPALITY_PAGES = 7; // 5,571 IBGE municipalities currently catalogued.
const CACHE_MS = 5 * 60_000;
let cached: Promise<GraphCatalog> | null = null;
let cacheExpiresAt = 0;

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Public SEO source unavailable");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function loadGraphUncached(): Promise<GraphCatalog> {
  const db = publicClient();
  const profiles: GraphProfile[] = [];
  for (let page = 0; page < MAX_PROFILE_PAGES; page++) {
    const { data, error } = await db.from("technicians")
      .select("public_slug,display_name,city,state_uf,specialties,service_slugs,updated_at")
      .eq("status", "aprovado")
      .order("created_at", { ascending: true })
      .range(page * BATCH, (page + 1) * BATCH - 1);
    if (error) throw new Error("Could not load approved public SEO profiles");
    profiles.push(...(data ?? []));
    if ((data ?? []).length < BATCH) break;
    if (page === MAX_PROFILE_PAGES - 1) throw new Error("Approved profiles require paginated sitemap index");
  }

  const cities: { name: string; uf: string }[] = [];
  for (let page = 0; page < MAX_MUNICIPALITY_PAGES; page++) {
    const { data, error } = await db.from("eut_ibge_municipalities")
      .select("name,uf")
      .order("id", { ascending: true })
      .range(page * MUNICIPALITY_BATCH, (page + 1) * MUNICIPALITY_BATCH - 1);
    if (error) throw new Error("Could not validate IBGE municipalities");
    cities.push(...(data ?? []));
    if ((data ?? []).length < MUNICIPALITY_BATCH) break;
    if (page === MAX_MUNICIPALITY_PAGES - 1) throw new Error("Municipality catalog requires pagination update");
  }

  const { data: activeCategories, error: categoryError } = await db
    .from("eut_service_categories").select("slug,label")
    .eq("active", true).limit(1000);
  if (categoryError) throw new Error("Could not validate active categories");

  return buildPublicGraph(profiles, cities, activeCategories ?? []);
}

/** Five-minute, public-only in-memory cache; no cookie, UUID or private contacts. */
export function getPublicGraphSnapshot(): Promise<GraphCatalog> {
  if (cached && Date.now() < cacheExpiresAt) return cached;
  cached = loadGraphUncached().catch((error: unknown) => {
    cached = null;
    cacheExpiresAt = 0;
    throw error;
  });
  cacheExpiresAt = Date.now() + CACHE_MS;
  return cached;
}

export const getSeoCity = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({
    uf: z.string().regex(/^[a-z]{2}$/),
    city: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(75),
  }).parse(input))
  .handler(async ({ data }) => {
    const graph = await getPublicGraphSnapshot();
    const city = graph.cities.find((c) => c.uf.toLowerCase() === data.uf && c.slug === data.city);
    if (!city) return null;
    const profiles = profilesInCity(graph, city.uf, city.slug);
    if (!profiles.length) return null;
    const specialties = new Set(profiles.flatMap((p) => p.specialties ?? []));
    const categories = graph.categories.filter((c) => specialties.has(c.slug)).slice(0, 24);
    return { city, profiles: profiles.slice(0, 120), categories };
  });

export const getSeoCategory = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ category: z.string().max(96) }).parse(input))
  .handler(async ({ data }) => {
    if (!validGraphSlug(data.category)) return null;
    const graph = await getPublicGraphSnapshot();
    const category = graph.categories.find((c) => c.slug === data.category);
    if (!category) return null;
    const profiles = profilesInCategory(graph, category.slug);
    if (!profiles.length) return null;
    const cityKeys = new Set(profiles.map((p) => `${p.state_uf?.toUpperCase()}|${p.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`));
    const cities = graph.cities.filter((city) =>
      cityKeys.has(`${city.uf}|${city.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`))
      .slice(0, 24);
    return { category, profiles: profiles.slice(0, 120), cities };
  });

export const getSeoProfileLinks = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(96) }).parse(input))
  .handler(async ({ data }) => {
    if (!validGraphSlug(data.slug)) return { city: null, categories: [], related: [] };
    const graph = await getPublicGraphSnapshot();
    const current = graph.profiles.find((p) => p.public_slug === data.slug);
    if (!current) return { city: null, categories: [], related: [] };
    const city = graph.cities.find((c) =>
      c.uf === current.state_uf && c.slug === current.city.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    const specialties = new Set(current.specialties ?? []);
    const categories = graph.categories.filter((c) => specialties.has(c.slug)).slice(0, 12);
    return { city: city ?? null, categories, related: relatedGraphProfiles(graph, current, 6) };
  });
