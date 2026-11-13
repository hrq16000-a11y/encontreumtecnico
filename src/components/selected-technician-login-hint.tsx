import { Info } from "lucide-react";

/** Read-only orientation before login; never displays private technician data. */
export function SelectedTechnicianLoginHint({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div role="status" aria-label="Continuidade do atendimento"
      className="mt-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-semibold">Você já escolheu um técnico</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Entre como cliente para continuar. Antes de compartilhar ou enviar o pedido,
          confirme o profissional selecionado na próxima etapa.
        </p>
      </div>
    </div>
  );
}
