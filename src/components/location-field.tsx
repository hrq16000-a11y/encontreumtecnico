import { useEffect, useId, useMemo, useState } from "react";
import { useMunicipalities, normalizedCityText } from "@/hooks/use-municipalities";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { neighborhoodCatalogFor, neighborhoodOptions } from "@/lib/neighborhood-sources";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { findOfficialHint, verifiedCepFor, type CepLookup, type LocationFieldValue } from "@/lib/location-field-validation";

export type { LocationFieldValue } from "@/lib/location-field-validation";
const control = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-primary";

/** Controlled location selection. IP is approximate; only a user-selected IBGE ID is committed.
 * Neighborhoods use partial municipal catalogs or verified ViaCEP evidence, never fabricated text.
 */
export function LocationField({ value, onChange, required = true, showCep = true,
  hintEnabled = true, label = "Localidade" }: {
  value: LocationFieldValue;
  onChange: (next: LocationFieldValue) => void;
  required?: boolean; showCep?: boolean; hintEnabled?: boolean; label?: string;
}) {
  const id = useId();
  const { area: hint } = useRegionalSuggestion();
  const useHint = hintEnabled && !value.uf && !value.city &&
    value.municipalityIbgeId === null && hint?.source === "ip";
  const uf = value.uf || (useHint ? hint?.uf ?? "" : "");
  const { cities, loading, error, retry } = useMunicipalities(uf);
  const [cityFilter, setCityFilter] = useState("");
  const [cepFilter, setCepFilter] = useState(value.postalCode);
  const [cepBusy, setCepBusy] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [cepNeighborhood, setCepNeighborhood] = useState("");
  const suggestedCity = useHint ? findOfficialHint(cities, hint?.city ?? "", uf) : null;
  const displayedId = value.municipalityIbgeId ?? suggestedCity?.id ?? "";
  const catalog = neighborhoodCatalogFor({
    city: value.city, uf: value.uf, municipalityIbgeId: value.municipalityIbgeId,
  });
  const neighborhoods = useMemo(() => {
    const options = [...neighborhoodOptions(catalog)];
    if (cepNeighborhood && !options.includes(cepNeighborhood)) options.push(cepNeighborhood);
    // Existing free-text data is preserved as unverified historical data, never generated.
    if (value.neighborhood && !options.includes(value.neighborhood)) options.push(value.neighborhood);
    return options;
  }, [catalog, cepNeighborhood, value.neighborhood]);
  const visibleCities = useMemo(() => {
    const found = cities.filter(city => !cityFilter.trim() ||
      normalizedCityText(city.name).includes(normalizedCityText(cityFilter))).slice(0, 40);
    const selected = cities.find(city => city.id === displayedId);
    return selected && !found.some(city => city.id === selected.id) ? [selected, ...found] : found;
  }, [cities, cityFilter, displayedId]);

  useEffect(() => { setCityFilter(""); setCepNeighborhood(""); }, [uf, value.municipalityIbgeId]);
  useEffect(() => { setCepFilter(value.postalCode); }, [value.postalCode, value.municipalityIbgeId]);

  function chooseCity(idToUse: number) {
    const chosen = cities.find(city => city.id === idToUse && city.uf === uf);
    if (!chosen || (value.municipalityIbgeId === chosen.id && value.uf === chosen.uf)) return;
    onChange({ uf: chosen.uf, city: chosen.name, municipalityIbgeId: chosen.id,
      neighborhood: "", postalCode: "" });
    setCepMessage("");
  }

  async function confirmCep() {
    if (cepBusy || value.municipalityIbgeId === null) {
      setCepMessage("Confirme o município oficial antes de consultar o CEP."); return;
    }
    const digits = cepFilter.replace(/\D/g, "");
    if (digits.length !== 8) { setCepMessage("Informe oito dígitos para consultar o CEP."); return; }
    setCepBusy(true); setCepMessage("");
    try {
      const response = await fetch("https://viacep.com.br/ws/" + digits + "/json/", {
        signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!response.ok) throw new Error("cep_http");
      const result = verifiedCepFor(value, digits, await response.json() as CepLookup);
      if (!result) { setCepMessage("CEP não corresponde ao município selecionado. Nada foi alterado."); return; }
      setCepNeighborhood(result.neighborhood);
      onChange({ ...value, postalCode: result.cep, neighborhood: result.neighborhood || value.neighborhood });
      setCepMessage("CEP verificado com município IBGE. Confira antes de salvar.");
    } catch {
      setCepMessage("CEP indisponível. Não foi usado nem presumido.");
    } finally { setCepBusy(false); }
  }

  return <fieldset className="grid min-w-0 gap-3 rounded-xl border border-border p-3" aria-label={label}>
    <legend className="px-1 text-sm font-semibold text-foreground">{label}</legend>
    <div className="grid min-w-0 gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
      <label htmlFor={id + "-uf"} className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">UF
        <select id={id + "-uf"} className={control} value={uf} required={required}
          onChange={event => onChange({uf:event.target.value,city:"",municipalityIbgeId:null,
            neighborhood:"",postalCode:""})}>
          <option value="">Selecione</option>
          {BRAZIL_STATES.map(code => <option key={code} value={code}>{code}</option>)}
        </select>
      </label>
      <label htmlFor={id + "-filter"} className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
        Filtrar municípios IBGE
        <input id={id + "-filter"} type="search" className={control}
          value={cityFilter} maxLength={80} disabled={!uf || loading || error}
          onChange={event => setCityFilter(event.target.value)}
          placeholder={uf ? "Digite apenas para filtrar opções" : "Selecione a UF"} />
      </label>
    </div>
    <label htmlFor={id + "-municipio"} className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
      Município oficial
      <select id={id + "-municipio"} className={control} required={required}
        disabled={!uf || loading || error} value={displayedId}
        onChange={event => chooseCity(Number(event.target.value))}>
        <option value="">Escolha no catálogo IBGE</option>
        {visibleCities.map(city => <option key={city.id} value={city.id}>{city.name}/{city.uf}</option>)}
      </select>
    </label>
    {loading && <p role="status" className="text-xs text-muted-foreground">Consultando municípios IBGE…</p>}
    {error && <p role="alert" className="text-xs text-destructive">Catálogo indisponível.{" "}
      <button type="button" className="underline" onClick={retry}>Tentar novamente</button>
    </p>}
    {suggestedCity && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="min-w-0 flex-1 text-xs text-foreground">
        IP sugere {suggestedCity.name}/{suggestedCity.uf}. É aproximado, não confirmado.
      </p>
      <button type="button" className="min-h-10 rounded-lg border border-primary px-3 text-xs font-semibold text-primary"
        onClick={() => chooseCity(suggestedCity.id)}>Confirmar sugestão</button>
    </div>}
    {useHint && !suggestedCity && !loading && !error && <p className="text-xs text-muted-foreground">
      Sugestão por IP não identificada no catálogo. Escolha na lista oficial.
    </p>}
    {value.city && value.municipalityIbgeId === null && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
      Cidade anterior “{value.city}” sem confirmação IBGE. Selecione uma opção da lista.
    </p>}
    {value.municipalityIbgeId !== null && <p role="status" className="text-xs text-muted-foreground">
      Município confirmado no formulário: IBGE {value.municipalityIbgeId}.
    </p>}
    <label htmlFor={id + "-bairro"} className="grid min-w-0 gap-1 text-sm font-semibold text-foreground">
      Bairro (opcional)
      <select id={id + "-bairro"} className={control} value={value.neighborhood}
        disabled={value.municipalityIbgeId === null}
        onChange={event => onChange({...value, neighborhood:event.target.value})}>
        <option value="">Não informado</option>
        {neighborhoods.map(bairro => <option key={bairro} value={bairro}>{bairro}</option>)}
      </select>
    </label>
    {catalog && <p className="text-xs text-muted-foreground">Catálogo municipal parcial:{" "}
      <a href={catalog.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{catalog.sourceName}</a>.
      Não garante todos os bairros nem confirma endereço privado.
    </p>}
    {!catalog && value.municipalityIbgeId !== null && <p className="text-xs text-muted-foreground">
      Bairro não disponível no catálogo municipal. Sem informação, deixe vazio; um CEP validado pode sugerir um.
    </p>}
    {showCep && <div className="grid min-w-0 gap-2">
      <label htmlFor={id + "-cep"} className="text-sm font-semibold text-foreground">
        CEP opcional (precisa de validação)
      </label>
      <div className="flex min-w-0 flex-wrap gap-2">
        <input id={id + "-cep"} className={control + " flex-1"} value={cepFilter}
          inputMode="numeric" maxLength={9} placeholder="00000000"
          onChange={event => {setCepFilter(event.target.value.replace(/\D/g,"").slice(0,8));setCepMessage("");}} />
        <button type="button" disabled={cepBusy || value.municipalityIbgeId === null}
          onClick={() => void confirmCep()}
          className="min-h-11 rounded-lg border border-input px-3 text-sm font-semibold disabled:opacity-50">
          {cepBusy ? "Verificando…" : "Validar CEP"}
        </button>
      </div>
      {cepMessage && <p role="status" className="text-xs text-foreground">{cepMessage}</p>}
      <p className="text-xs text-muted-foreground">
        CEP só é gravado após validação por ViaCEP e correspondência com o município IBGE.
        {value.postalCode ? " CEP cadastrado: " + value.postalCode.replace(/\D/g,"") : ""}
      </p>
    </div>}
  </fieldset>;
}
