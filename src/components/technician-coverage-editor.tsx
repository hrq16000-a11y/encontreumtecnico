import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { useMunicipalities, normalizedCityText, type Municipality } from "@/hooks/use-municipalities";

const db = supabase as unknown as SupabaseClient;
const RADII = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300] as const;

export function TechnicianCoverageEditor({
  userId, baseMunicipality, savedCityIds, savedRadius,
}: {
  userId: string;
  baseMunicipality: Municipality | null;
  savedCityIds: number[];
  savedRadius: number | null;
}) {
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const [extraUf, setExtraUf] = useState(baseMunicipality?.uf || "PR");
  const { cities, loading, error, retry } = useMunicipalities(extraUf);
  const [search, setSearch] = useState("");
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [citiesSelected, setCitiesSelected] = useState<Municipality[]>([]);
  const [radius, setRadius] = useState<number | null>(savedRadius);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    const owner = userId;
    setMessage("");
    setCitiesSelected([]);
    setRadius(savedRadius);
    setExtraUf(baseMunicipality?.uf || "PR");
    const extras = savedCityIds.filter((id) => id !== baseMunicipality?.id).slice(0, 5);
    if (extras.length > 0) {
      void Promise.resolve(db.from("eut_ibge_municipalities")
        .select("id,name,uf,latitude,longitude").in("id", extras)).then(({ data, error }) => {
        if (live && activeUser.current === owner) {
          if (error) setMessage("Não conseguimos recuperar as cidades anteriores. Recarregue antes de salvar.");
          else setCitiesSelected((data ?? []) as Municipality[]);
        }
      }).catch(() => {
        if (live && activeUser.current === owner) setMessage("Não conseguimos recuperar as cidades anteriores.");
      });
    }
    return () => { live = false; };
    // Reset when the technician account changes; changing the base city is
    // an explicit save in the main registration form, not a silent reset here.
  }, [userId]);

  const extras = citiesSelected.filter((city) => city.id !== baseMunicipality?.id);
  const shown = cities.filter((city) => !search || normalizedCityText(city.name).includes(normalizedCityText(search)))
    .filter((city) => city.id !== baseMunicipality?.id && !extras.some((extra) => extra.id === city.id))
    .slice(0, 20);
  const option = cities.find((city) => city.id === candidateId);
  const missingExisting = savedCityIds.length > 1 && citiesSelected.length === 0 && Boolean(message);

  async function save() {
    if (!baseMunicipality || saving || missingExisting) return;
    const codes = [baseMunicipality.id, ...extras.map((city) => city.id)];
    if (codes.length > 5 || new Set(codes).size !== codes.length) {
      setMessage("Escolha no máximo cinco cidades diferentes, contando a cidade-base.");
      return;
    }
    const owner = userId;
    setSaving(true); setMessage("");
    try {
      const { data, error } = await db.rpc("eut_set_my_technician_coverage", {
        _radius_km: radius, _city_ids: codes,
      });
      if (activeUser.current !== owner) return;
      if (error || data?.state !== "salvo") {
        setMessage("Não foi possível salvar. Confirme a cidade-base no cadastro e tente novamente.");
      } else {
        setMessage("Raio e cidades salvos no perfil público. As distâncias são aproximadas.");
      }
    } catch {
      if (activeUser.current === owner) setMessage("Falha de conexão. Nenhuma nova região foi confirmada.");
    } finally {
      if (activeUser.current === owner) setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="territorio-heading">
      <h2 id="territorio-heading" className="text-lg font-bold text-card-foreground">Área de atendimento</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Declare um raio a partir do centro de referência da cidade-base e até 5 cidades brasileiras,
        contando a própria base. O raio é aproximado em linha reta, não uma rota ou tempo de viagem.
      </p>
      <p className="mt-3 text-sm font-semibold text-foreground">
        Cidade-base: {baseMunicipality ? baseMunicipality.name + "/" + baseMunicipality.uf : "confirme a cidade-base no formulário acima"}
      </p>
      <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="eut-service-radius">Raio de atendimento declarado</label>
      <select id="eut-service-radius" value={radius ?? ""} onChange={(event) => setRadius(event.target.value ? Number(event.target.value) : null)}
        className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground">
        <option value="">Sem raio declarado (somente cidades selecionadas)</option>
        {RADII.map((km) => <option key={km} value={km}>{km} km aproximados</option>)}
      </select>
      <div className="mt-5">
        <p className="text-sm font-semibold text-foreground">Cidades atendidas ({1 + extras.length}/5, incluindo a base)</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {baseMunicipality && <li className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">{baseMunicipality.name}/{baseMunicipality.uf} · base</li>}
          {extras.map((city) => <li key={city.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 pl-3 pr-1 text-xs text-foreground">
            <span>{city.name}/{city.uf}</span>
            <button type="button" disabled={saving} aria-label={"Remover " + city.name + "/" + city.uf}
              className="min-h-10 rounded-md px-3 font-bold text-primary hover:bg-accent"
              onClick={() => setCitiesSelected((current) => current.filter((c) => c.id !== city.id))}>×</button>
          </li>)}
        </ul>
      </div>
      {extras.length < 4 && (
        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/20 p-4">
          <label className="text-sm font-semibold text-foreground" htmlFor="eut-city-extra-uf">UF da cidade adicional</label>
          <select id="eut-city-extra-uf" value={extraUf} onChange={(event) => {
            setExtraUf(event.target.value); setSearch(""); setCandidateId(null);
          }} className="min-h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground">
            {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          <label className="text-sm font-semibold text-foreground" htmlFor="eut-city-extra-search">Pesquisar cidade adicional</label>
          <input id="eut-city-extra-search" type="search" value={search} onChange={(event) => {
            setSearch(event.target.value); setCandidateId(null);
          }} placeholder="Digite parte do município"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground" />
          <label className="text-sm font-semibold text-foreground" htmlFor="eut-city-extra-select">Escolher cidade validada</label>
          <select id="eut-city-extra-select" value={option && shown.some((c) => c.id === option.id) ? option.id : ""}
            disabled={loading || error} onChange={(event) => setCandidateId(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground">
            <option value="">{loading ? "Carregando..." : "Selecione na lista"}</option>
            {shown.map((city) => <option key={city.id} value={city.id}>{city.name}/{city.uf}</option>)}
          </select>
          {error && <p role="alert" className="text-xs text-destructive">Falha ao carregar municípios. <button type="button" className="underline" onClick={retry}>Tentar novamente</button></p>}
          <button type="button" disabled={!option || saving || loading} onClick={() => {
            if (!option) return;
            setCitiesSelected((current) => current.some((x) => x.id === option.id)
              ? current : [...current, option].slice(0, 4));
            setCandidateId(null); setSearch("");
          }} className="min-h-11 rounded-lg border border-primary bg-background px-4 text-sm font-semibold text-primary hover:bg-accent disabled:opacity-50">
            Adicionar cidade ({extras.length}/4 adicionais)
          </button>
        </div>
      )}
      <button type="button" disabled={!baseMunicipality || saving || missingExisting}
        onClick={() => void save()}
        className="mt-5 min-h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {saving ? "Salvando cobertura..." : "Salvar raio e cidades atendidas"}
      </button>
      {message && <p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
    </section>
  );
}
