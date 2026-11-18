import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PublicServiceCategory = {
  slug: string;
  label: string;
  description: string;
};

type PublicServiceCategoryResult = {
  categories: PublicServiceCategory[];
  unavailable: boolean;
};

/** Read only the active, public taxonomy; private technician records stay out of this query. */
async function loadPublicServiceCategories(): Promise<PublicServiceCategoryResult> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { categories: [], unavailable: true };

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
    const { data, error } = await client.from("eut_service_categories")
      .select("slug,label,description")
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("slug", { ascending: true });
    if (error || !Array.isArray(data)) return { categories: [], unavailable: true };
    return { categories: data, unavailable: false };
  } catch {
    return { categories: [], unavailable: true };
  }
}

export const getPublicServiceCategories = createServerFn({ method: "GET" })
  .handler(loadPublicServiceCategories);
