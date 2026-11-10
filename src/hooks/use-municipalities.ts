import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";

export type Municipality = {
  id: number;
  name: string;
  uf: string;
  latitude: number;
  longitude: number;
};

const db = supabase as unknown as SupabaseClient;
const cache = new Map<string, Promise<Municipality[]>>();

export function normalizedCityText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

async function loadMunicipalities(uf: string): Promise<Municipality[]> {
  const { data, error } = await db.from("eut_ibge_municipalities")
    .select("id,name,uf,latitude,longitude")
    .eq("uf", uf).order("name").limit(1000);
  if (error) throw error;
  return (data ?? []) as Municipality[];
}

export function useMunicipalities(uf: string) {
  const [state, setState] = useState<{
    uf: string; cities: Municipality[]; loading: boolean; error: boolean;
  }>({ uf: "", cities: [], loading: false, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!BRAZIL_STATES.some((code) => code === uf)) {
      setState({ uf, cities: [], loading: false, error: false });
      return () => { alive = false; };
    }
    setState({ uf, cities: [], loading: true, error: false });
    if (!cache.has(uf)) {
      cache.set(uf, loadMunicipalities(uf).catch((error: unknown) => {
        cache.delete(uf);
        throw error;
      }));
    }
    void cache.get(uf)!.then((cities) => {
      if (alive) setState({ uf, cities, loading: false, error: false });
    }).catch(() => {
      if (alive) setState({ uf, cities: [], loading: false, error: true });
    });
    return () => { alive = false; };
  }, [uf, retry]);
  return {
    cities: state.uf === uf ? state.cities : [],
    loading: state.uf === uf && state.loading,
    error: state.uf === uf && state.error,
    retry: () => setRetry((n) => n + 1),
  };
}
