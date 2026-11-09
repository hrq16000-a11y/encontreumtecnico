import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActiveCategory = {
  slug: string;
  label: string;
  description: string;
};

export function useActiveCategories() {
  const [categories, setCategories] = useState<ActiveCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.from("eut_service_categories")
      .select("slug,label,description")
      .eq("active", true)
      .order("display_order")
      .then(({ data, error: queryError }) => {
        if (!mounted) return;
        setCategories(queryError ? [] : (data ?? []));
        setError(Boolean(queryError));
        setLoading(false);
      }).catch(() => {
        if (!mounted) return;
        setCategories([]);
        setError(true);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { categories, loading, error };
}

export function categoryLabel(slug: string, categories: ActiveCategory[]): string {
  return categories.find((c) => c.slug === slug)?.label ?? slug;
}
