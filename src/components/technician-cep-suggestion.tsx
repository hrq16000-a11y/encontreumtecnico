import { useState } from "react";
import { useMunicipalities, type Municipality } from "@/hooks/use-municipalities";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";

type CepResult = { uf?: string; localidade?: string; bairro?: string; ibge?: string; erro?: boolean };

/** A CEP is a hint, never an unverified municipality or a published address. */
export function TechnicianCepSuggestion({
  onChoose,
}: {
  onChoose: (city: Municipality, neighborhood: string) => void;
}) {
  const [cep, setCep] = useState("");
  const [candidate, setCandidate] = useState<CepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { cities, loading, error } = useMunicipalities(candidate?.uf ?? "");
  const validCandidate = candidate && cities.find(city =>
    city.uf === candidate.uf &&
    city.id === Number(candidate.ibge) &&
    city.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ===
      (candidate.localidade ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  );
  async function consult() {
    const digits = cep.replace(/\D/g, "");
    setCandidate(null);
    if (digits.length !== 8) { setMessage("Informe um CEP com oito dígitos."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!response.ok) throw new Error("cep-unavailable");
      const data = await response.json() as CepResult;
      if (data.erro || !data.uf || !BRAZIL_STATES.some(uf => uf === data.uf) || !/^\d{7}$/.test(data.ibge ?? "")) {
        setMessage("CEP não localizado. Escolha seu município na lista oficial.");
        return;
      }
      setCandidate(data);
    } catch {
      setMessage("Consulta de CEP indisponível. Use a seleção de municípios abaixo.");
    } finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-border bg-muted/20 p-3">
    <label htmlFor="eut-tecnico-cep" className="block text-sm font-semibold text-foreground">
      Seu CEP (opcional) — sugerir cidade e bairro
    </label>
    <div className="mt-2 flex flex-wrap gap-2">
      <input id="eut-tecnico-cep" inputMode="numeric" autoComplete="postal-code" maxLength={9}
        placeholder="00000-000" value={cep} onChange={event => {
          setCep(event.target.value); setCandidate(null); setMessage("");
        }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base text-foreground" />
      <button type="button" onClick={() => void consult()} disabled={busy}
        className="min-h-11 rounded-lg border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-50">
        {busy ? "Consultando…" : "Buscar CEP"}
      </button>
    </div>
    {candidate && <div className="mt-3">
      {loading ? <p role="status" className="text-sm">Confirmando município no catálogo IBGE…</p>
      : error || !validCandidate ? <p role="alert" className="text-sm text-foreground">Não foi possível validar esta cidade na lista oficial. Selecione manualmente abaixo.</p>
      : <button type="button" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          onClick={() => { onChoose(validCandidate, candidate.bairro ?? ""); setMessage("Localidade selecionada. Confira antes de publicar."); setCandidate(null); }}>
          Usar {validCandidate.name}/{validCandidate.uf}{candidate.bairro ? ` · ${candidate.bairro}` : ""}
        </button>}
    </div>}
    {message && <p className="mt-2 text-xs text-foreground" role="status">{message}</p>}
    <p className="mt-2 text-xs text-muted-foreground">O CEP é usado somente nesta consulta e não revela nem publica o endereço do técnico. Município deve corresponder ao cadastro oficial.</p>
  </div>;
}
