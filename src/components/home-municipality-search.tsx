import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { normalizedCityText, type Municipality } from "@/hooks/use-municipalities";

export type HomeLocationFilters = {
  cidade: string;
  uf: string;
  bairro: string;
  prioridade: string;
};

/** The persisted identifier is an untrusted text draft until checked against the
 * official catalogue for the selected UF. Never interpret city text as an IBGE ID.
 */
export function parseHomeCityId(value: string | undefined): number | null {
  return value && /^[1-9][0-9]{6}$/.test(value) ? Number(value) : null;
}

/** One explicitly selected municipality, with name, UF and ID all matching the
 * current official list. A regional/IP hint or legacy text draft is never enough.
 */
export function confirmedHomeCity(
  uf: string,
  name: string,
  selectedId: number | null,
  cities: readonly Municipality[],
): Municipality | null {
  if (!BRAZIL_STATES.some((code) => code === uf) ||
      !Number.isInteger(selectedId) || !selectedId ||
      !normalizedCityText(name)) return null;
  const matches = cities.filter(city =>
    city.id === selectedId && city.uf === uf &&
    normalizedCityText(city.name) === normalizedCityText(name));
  return matches.length === 1 ? matches[0]! : null;
}

/** null means that a typed/suggested city still needs official confirmation.
 * Empty city + UF is a legitimate state-wide search, not an invented city.
 */
export function homeLocationFilters(
  uf: string,
  name: string,
  selectedId: number | null,
  cities: readonly Municipality[],
  neighborhood: string,
): HomeLocationFilters | null {
  const verified = confirmedHomeCity(uf, name, selectedId, cities);
  if (name.trim() && !verified) return null;
  const state = BRAZIL_STATES.some(code => code === uf) ? uf : "";
  return {
    cidade: verified?.name ?? "",
    uf: state,
    bairro: verified ? neighborhood.trim() : "",
    prioridade: state ? "regiao" : "",
  };
}

/** Explicit, keyboard-friendly municipal selection; never submits a free-text
 * city or a regional hint as a confirmed municipality.
 */
export function HomeMunicipalitySearch({
  uf, cityName, selectedId, cities, loading, error, retry,
  showValidationError, onUfChange, onCityTextChange, onSelectCity,
}: {
  uf: string;
  cityName: string;
  selectedId: number | null;
  cities: readonly Municipality[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  showValidationError: boolean;
  onUfChange: (uf: string) => void;
  onCityTextChange: (value: string) => void;
  onSelectCity: (city: Municipality) => void;
}) {
  const confirmed = confirmedHomeCity(uf, cityName, selectedId, cities);
  const query = normalizedCityText(cityName);
  const matches = cities.filter(city =>
    city.uf === uf && (!query || normalizedCityText(city.name).includes(query))
  ).slice(0, 20);
  if (confirmed && !matches.some(city => city.id === confirmed.id)) {
    matches.unshift(confirmed);
  }
  return (
    <div className="min-w-0 sm:col-span-2">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <label htmlFor="busca-uf" className="block text-xs font-semibold text-foreground">UF</label>
          <select id="busca-uf" value={uf} autoComplete="address-level1"
            onChange={event => onUfChange(event.target.value)}
            className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <option value="">Todas</option>
            {BRAZIL_STATES.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="busca-cidade" className="block text-xs font-semibold text-foreground">
            Buscar município
          </label>
          <input id="busca-cidade" type="search" autoComplete="off" value={cityName}
            onChange={event => onCityTextChange(event.target.value)}
            disabled={!uf} aria-invalid={showValidationError && !!cityName.trim()}
            placeholder={uf ? "Digite parte do nome" : "Selecione a UF primeiro"}
            className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70" />
        </div>
      </div>
      <label htmlFor="busca-cidade-ibge" className="mt-2 block text-xs font-semibold text-foreground">
        Confirmar município na lista oficial (IBGE)
      </label>
      <select id="busca-cidade-ibge" value={confirmed?.id ?? ""}
        disabled={!uf || loading || error}
        onChange={event => {
          const city = cities.find(item =>
            item.id === Number(event.target.value) && item.uf === uf);
          if (city) onSelectCity(city);
        }}
        aria-describedby="home-city-feedback"
        className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70">
        <option value="">{loading ? "Carregando cidades…" : "Selecione um município oficial"}</option>
        {matches.map(city => <option key={city.id} value={city.id}>{city.name}/{city.uf}</option>)}
      </select>
      <div id="home-city-feedback" aria-live="polite" className="mt-1 text-xs text-muted-foreground">
        {error ? (
          <span role="alert">
            Não foi possível consultar municípios.
            {" "}<button type="button" className="font-semibold text-primary underline" onClick={retry}>Tentar novamente</button>
          </span>
        ) : showValidationError && cityName.trim() && !confirmed ? (
          <span role="alert">Confirme o município e a UF na lista oficial antes de buscar.</span>
        ) : confirmed ? (
          <span>Município confirmado: {confirmed.name}/{confirmed.uf} · IBGE {confirmed.id}</span>
        ) : cityName.trim() ? (
          <span>Cidade digitada ou sugerida: confirme na lista oficial para pesquisar por município.</span>
        ) : (
          <span>Você também pode pesquisar somente por UF ou em todo o Brasil.</span>
        )}
      </div>
    </div>
  );
}
