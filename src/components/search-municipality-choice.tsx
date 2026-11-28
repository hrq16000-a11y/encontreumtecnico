import { useMunicipalities } from "@/hooks/use-municipalities";
import { SearchableChoice } from "@/components/ui/searchable-choice";
import { DebouncedTextFilter } from "@/components/debounced-text-filter";
import { Button } from "@/components/ui/button";

/** Discovery remains usable without the official catalogue. Manual text is
 * never presented as a verified municipality or used to persist an IBGE ID. */
export function SearchMunicipalityChoice({ id, uf, city, onChange }: {
  id: string; uf: string; city: string;
  onChange: (city: string, uf: string) => void;
}) {
  const { cities, loading, error, retry } = useMunicipalities(uf);
  const options = cities.map(item => ({
    value: String(item.id), label: `${item.name}/${item.uf}`,
    displayLabel: item.name, keywords: item.name,
  }));
  const selected = cities.filter(item => item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const selectedCity = selected.length === 1 ? selected[0] : undefined;

  return <div className="min-w-0">
    {uf && !error && cities.length > 0 ? <>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Cidade</label>
      <SearchableChoice id={id} value={selectedCity ? String(selectedCity.id) : ""}
        options={options} clearOnEdit={false} placeholder="Digite o município"
        className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onChange={value => {
          const municipality = cities.find(item => String(item.id) === value);
          if (municipality) onChange(municipality.name, municipality.uf);
        }} />
      {city && !selectedCity && <p role="status" className="mt-1 text-xs text-muted-foreground">Filtro atual: {city}. Confirme um município da lista para substituí-lo.</p>}
      {city && <Button variant="ghost" type="button" className="mt-1 min-h-11" onClick={() => onChange("", uf)}>Todas as cidades</Button>}
    </> : <DebouncedTextFilter id={id} label="Cidade" value={city}
      placeholder={uf ? "Digite a cidade" : "Ex.: São Paulo"}
      onCommit={value => onChange(value, uf)} onBlurTrack={() => {}} />}
    {loading && <p role="status" className="mt-1 text-xs text-muted-foreground">Carregando municípios…</p>}
    {!uf && <p className="mt-1 text-xs text-muted-foreground">Selecione a UF para confirmar cidades de mesmo nome.</p>}
    {error && <div role="alert" className="mt-1 text-sm text-destructive">Lista indisponível; a busca manual continua disponível. <Button variant="link" type="button" className="min-h-11" onClick={retry}>Tentar novamente</Button></div>}
    {uf && !loading && !error && cities.length === 0 && <p role="status" className="mt-1 text-xs text-muted-foreground">Sem municípios na lista; use a busca manual.</p>}
  </div>;
}