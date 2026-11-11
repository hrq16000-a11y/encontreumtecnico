import { useEffect, useState } from "react";
import { listApprovedTechnicians, type PublicTechnician } from "@/lib/technicians.functions";
import { publishedTechnicianSuggestions } from "@/lib/client-technician-picker";
import { TechnicianAvatar } from "@/components/technician-avatar";

type Props = {
  category: string;
  city: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** Search stays inside the client wizard: never navigates away with an unsaved
 * request. It loads only PUBLIC approved profiles, not private contact data.
 * No result is automatically selected and no request is sent by this widget.
 */
export function ClientTechnicianPicker({ category, city, selectedId, onSelect }: Props) {
  const [results, setResults] = useState<PublicTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    setResults([]);
    if (!category.trim() || !city.trim()) {
      setLoading(false);
      return () => { current = false; };
    }
    void listApprovedTechnicians({
      data: {
        especialidade: category, cidade: city.trim(), regiao: "", servico: "",
        uf: "", bairro: "", prioridade: "regiao",
      },
    }).then((profiles) => {
      if (!current) return;
      setResults(publishedTechnicianSuggestions(profiles, category));
      setLoading(false);
    }).catch(() => {
      if (!current) return;
      setResults([]);
      setError(true);
      setLoading(false);
    });
    return () => { current = false; };
  }, [category, city, reload]);

  return (
    <section aria-label="Escolher técnico sem sair da solicitação"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h4 className="text-base font-bold text-foreground">
        Técnicos com perfil publicado
      </h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Sugestões por especialidade, priorizando a cidade informada. A região
        é declarada pelo próprio profissional; não significa distância medida,
        disponibilidade imediata nem garantia de atendimento.
      </p>
      {loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Buscando perfis publicados…</p>
      ) : error ? (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-sm text-destructive">
            Não foi possível consultar os técnicos agora. O pedido ainda pode ser salvo em particular.
          </p>
          <button type="button" onClick={() => setReload((count) => count + 1)}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-foreground">
            Tentar novamente
          </button>
        </div>
      ) : results.length ? (
        <ul className="mt-4 grid gap-3" aria-label="Técnicos publicados sugeridos">
          {results.map((technician) => (
            <li key={technician.id}>
              <button type="button"
                onClick={() => onSelect(technician.id)}
                aria-pressed={selectedId === technician.id}
                className={`flex min-h-20 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedId === technician.id
                  ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"}`}>
                <TechnicianAvatar name={technician.display_name} avatarPath={technician.avatar_path}
                  className="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold text-foreground">
                    {technician.display_name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {technician.city}{technician.state_uf ? `/${technician.state_uf}` : ""}
                    {technician.neighborhood ? ` · ${technician.neighborhood}` : ""}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Perfil publicado · disponibilidade não confirmada
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-primary">
                  {selectedId === technician.id ? "Selecionado" : "Escolher"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          Nenhum perfil publicado encontrado para essa especialidade.
          Você pode guardar o pedido em particular e consultar a busca depois.
        </p>
      )}

      <button type="button" onClick={() => onSelect(null)}
        aria-pressed={selectedId === null}
        className="mt-4 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:border-primary/50">
        {selectedId ? "Remover técnico e guardar em particular" : "Continuar sem técnico — guardar em particular"}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Escolher um perfil não envia sua descrição. Somente a autorização
        explícita na próxima opção permite solicitar o compartilhamento.
      </p>
    </section>
  );
}
