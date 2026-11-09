import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { BRAZIL_STATES, validMunicipality } from "@/lib/service-taxonomy";

const db = supabase as unknown as SupabaseClient;
type Area = {
  source_key: string;
  wp_post_id: number;
  state_uf: string;
  municipality: string;
  neighborhood: string;
  status: "pendente" | "confirmado";
  evidence: string;
};

export function EutCoverageManager({ sourceKey, wpPostId }: { sourceKey: string; wpPostId: number }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data, error } = await db.from("eut_legacy_service_areas")
      .select("source_key,wp_post_id,state_uf,municipality,neighborhood,status,evidence")
      .eq("source_key", sourceKey).eq("wp_post_id", wpPostId)
      .order("state_uf").order("municipality").order("neighborhood");
    if (error) setMessage("Não foi possível carregar as áreas de atendimento.");
    else setAreas((data ?? []) as Area[]);
  }
  useEffect(() => { void load(); }, [sourceKey, wpPostId]);

  async function execute(fn: () => Promise<{error?: {message: string} | null}>, message: string) {
    if (busy) return false;
    setBusy(true);
    try {
      const result = await fn();
      if (result.error) { setMessage("Não foi possível salvar. Verifique os dados e as permissões."); return false; }
      setMessage(message);
      return true;
    } catch {
      setMessage("Falha ao consultar o banco de dados.");
      return false;
    } finally { setBusy(false); }
  }

  async function addArea(event: FormEvent) {
    event.preventDefault();
    if (!validMunicipality(uf, city)) {
      setMessage("Selecione a UF e um município válido. Não use Brasil como cidade.");
      return;
    }
    const municipality = city.trim().slice(0, 100);
    const bairro = neighborhood.trim().slice(0, 100);
    const ok = await execute(async () => db.from("eut_legacy_service_areas")
      .insert({ source_key: sourceKey, wp_post_id: wpPostId, state_uf: uf,
        municipality, neighborhood: bairro, status: "pendente", evidence: "" }),
      "Área adicionada como pendente, ainda não publicada.");
    if (ok) { setCity(""); setNeighborhood(""); await load(); }
  }

  async function confirmArea(area: Area) {
    const proof = evidence.trim().slice(0, 500);
    if (proof.length < 12) {
      setMessage("Informe a fonte da confirmação (12 caracteres ou mais).");
      return;
    }
    const ok = await execute(async () => db.from("eut_legacy_service_areas")
      .update({ status: "confirmado", evidence: proof })
      .eq("source_key", sourceKey).eq("wp_post_id", wpPostId)
      .eq("state_uf", area.state_uf).eq("municipality", area.municipality)
      .eq("neighborhood", area.neighborhood), "Área confirmada na ficha administrativa.");
    if (ok) { setEvidence(""); await load(); }
  }

  async function removeArea(area: Area) {
    if (!window.confirm("Remover esta área de atendimento da ficha histórica?")) return;
    const ok = await execute(async () => db.from("eut_legacy_service_areas")
      .delete().eq("source_key", sourceKey).eq("wp_post_id", wpPostId)
      .eq("state_uf", area.state_uf).eq("municipality", area.municipality)
      .eq("neighborhood", area.neighborhood), "Área removida da ficha de atendimento.");
    if (ok) await load();
  }
  const field = "min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  const btn = "min-h-10 rounded-md border border-input px-3 text-sm text-foreground disabled:opacity-50";
  return (
    <section className="mt-6 border-t border-border pt-5" aria-label="Cobertura geográfica do técnico">
      <h4 className="font-semibold text-foreground">Municípios e bairros atendidos</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Adicione quantas áreas forem necessárias. A inclusão não comprova atendimento
        nem habilita o contato até a verificação independente do prestador.
      </p>
      {message && <p role="status" className="mt-3 rounded-md bg-muted p-3 text-sm">{message}</p>}
      <form onSubmit={addArea} className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">Estado
          <select className={field} value={uf} onChange={e => setUf(e.target.value)} required>
            <option value="">UF a confirmar</option>
            {BRAZIL_STATES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Município
          <input className={field} value={city} maxLength={100} required
            onChange={e => setCity(e.target.value)} placeholder="Ex.: Curitiba"/>
        </label>
        <label className="grid gap-1 text-sm">Bairro (opcional)
          <input className={field} value={neighborhood} maxLength={100}
            onChange={e => setNeighborhood(e.target.value)} placeholder="Ex.: Centro"/>
        </label>
        <button className={btn + " md:col-span-3"} disabled={busy} type="submit">
          Adicionar área pendente
        </button>
      </form>
      <label className="mt-4 grid gap-1 text-sm">
        Fonte da confirmação da área (sem documentos ou informações pessoais)
        <input className={field} value={evidence} maxLength={500}
          onChange={e => setEvidence(e.target.value)}
          placeholder="Ex.: cobertura confirmada pelo titular em revisão"/>
      </label>
      {areas.length === 0
        ? <p className="mt-4 text-xs text-muted-foreground">Nenhuma área de atendimento cadastrada.</p>
        : <ul className="mt-3 space-y-2">
          {areas.map(area => (
            <li key={area.state_uf + ":" + area.municipality + ":" + area.neighborhood}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="text-sm">
                <strong>{area.municipality}/{area.state_uf}</strong>
                {area.neighborhood && <span> · {area.neighborhood}</span>}
                <p className="text-xs text-muted-foreground">
                  {area.status === "confirmado" ? "Cobertura confirmada administrativamente" : "Pendente de comprovação"}
                </p>
              </div>
              <div className="flex gap-2">
                {area.status !== "confirmado" &&
                  <button className={btn} disabled={busy} type="button" onClick={() => void confirmArea(area)}>
                    Confirmar
                  </button>}
                <button className={btn} disabled={busy} type="button" onClick={() => void removeArea(area)}>
                  Retirar
                </button>
              </div>
            </li>
          ))}
        </ul>
      }
    </section>
  );
}
