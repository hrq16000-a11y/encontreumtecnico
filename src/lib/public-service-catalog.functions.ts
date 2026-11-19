import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicServiceCategory = {
  slug: string;
  label: string;
  description: string;
};

export type PublicServiceType = {
  slug: string;
  category_slug: string;
  label: string;
  description: string;
};

type PublicServiceCategoryResult = {
  categories: PublicServiceCategory[];
  services: PublicServiceType[];
  unavailable: boolean;
  servicesUnavailable: boolean;
};

/** Read only the active, public taxonomy; private technician records stay out of this query. */
async function loadPublicServiceCategories(): Promise<PublicServiceCategoryResult> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { categories: [], services: [], unavailable: true, servicesUnavailable: true };

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers, cache: "no-store" });
      },
    },
  });

  try {
    const [categoriesResult, servicesResult] = await Promise.all([
      client.from("eut_service_categories")
        .select("slug,label,description")
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("slug", { ascending: true }),
      client.from("eut_service_types")
        .select("slug,category_slug,label,description")
        .eq("active", true)
        .order("display_order", { ascending: true })
        .order("slug", { ascending: true }),
    ]);
    if (categoriesResult.error || !Array.isArray(categoriesResult.data)) {
      return { categories: [], services: [], unavailable: true, servicesUnavailable: true };
    }
    const categories = categoriesResult.data;
    const activeSlugs = new Set(categories.map((category) => category.slug));
    const servicesUnavailable = Boolean(servicesResult.error || !Array.isArray(servicesResult.data));
    const services = servicesUnavailable ? [] :
      (servicesResult.data ?? []).filter((service) => activeSlugs.has(service.category_slug));
    return { categories, services, unavailable: false, servicesUnavailable };
  } catch {
    return { categories: [], services: [], unavailable: true, servicesUnavailable: true };
  }
}

export const getPublicServiceCategories = createServerFn({ method: "GET" })
  .handler(loadPublicServiceCategories);
