import { useEffect, useMemo, useState } from "react";
import { normalizedCityText, useMunicipalities, type Municipality } from "@/hooks/use-municipalities";

/** No free-form municipality submission: an official numeric IBGE ID is selected. */
export function MunicipalityPicker({
  uf, selectedId, currentCityName, onSelect,
}: {
  uf: string;
  selectedId: number | null;
  currentCityName: string;
  onSelect: (city: Municipality) => void;
}) {
  const { cities, loading, error, retry } = useMunicipalities(uf);
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(""), [uf]);

  // Existing profiles (and GPS hints) can prefill only when their text matches
  // the frozen official list. Unknown legacy labels are never silently guessed.
  useEffect(() => {
    if (selectedId || !currentCityName || cities.length === 0) return;
    const matched = cities.find((city) => normalizedCityText(city.name) === normalizedCityText(currentCityName));
    if (matched) onSelect(matched);
  }, [selectedId, currentCityName, cities, onSelect]);

  const visible = useMemo(() => {
    const needle = normalizedCityText(query);
    const matched = cities.filter((city) => !needle || normalizedCityText(city.name).includes(needle)).slice(0, 20);
    const chosen = cities.find((city) => city.id === selectedId);
    return chosen && !matched.some((city) => city.id === chosen.id) ? [chosen, ...matched] : matched;
  }, [cities, query, selectedId]);

  return (
    <div className="grid gap-2">
      <label htmlFor="municipio-busca" className="text-sm font-semibold text-foreground">Pesquisar município oficial</label>
      <input id="municipio-busca" type="search" value={query} disabled={!uf || loading || error}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={uf ? "Digite parte do nome (ex.: São José)" : "Selecione primeiro uma UF"}
        className="min-h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
      {loading && <p role="status" className="text-xs text-muted-foreground">Carregando municípios oficiais…</p>}
      {error && <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar a lista de municípios. <button type="button" className="font-semibold underline" onClick={retry}>Tentar novamente</button>
      </p>}
      <label htmlFor="municipio-opcoes" className="text-sm font-semibold text-foreground">Município-base confirmado</label>
      <select id="municipio-opcoes" required value={selectedId ?? ""} disabled={!uf || loading || error}
        onChange={(event) => {
          const found = cities.find((item) => item.id === Number(event.target.value));
          if (found) { onSelect(found); setQuery(""); }
        }}
        className="min-h-12 rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">Escolha uma cidade da lista</option>
        {visible.map((city) => <option key={city.id} value={city.id}>{city.name}/{city.uf}</option>)}
      </select>
      {currentCityName && !selectedId && !loading && !error && uf && (
        <p className="text-xs text-amber-800 dark:text-amber-200" role="status">
          Município anterior ou sugestão GPS: “{currentCityName}”. Selecione o nome oficial acima antes de publicar.
        </p>
      )}
      {selectedId && <p className="text-xs font-medium text-foreground">
        Validado pelo catálogo de municípios · código IBGE {selectedId}
      </p>}
    </div>
  );
}
