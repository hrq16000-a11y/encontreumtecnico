import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActiveService = { slug: string; category_slug: string; label: string };

export function useActiveServices() {
  const [services, setServices] = useState<ActiveService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.from("eut_service_types")
      .select("slug,category_slug,label")
      .eq("active", true)
      .order("display_order")
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setServices(queryError ? [] : (data ?? []) as ActiveService[]);
        setError(Boolean(queryError));
        setLoading(false);
      }).catch(() => {
        if (active) { setServices([]); setError(true); setLoading(false); }
      });
    return () => { active = false; };
  }, []);

  return { services, loading, error };
}

export function serviceLabel(slug: string, services: ActiveService[]) {
  return services.find((service) => service.slug === slug)?.label ?? slug;
}
