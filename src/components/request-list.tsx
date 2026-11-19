import type { Tables } from "@/integrations/supabase/types";

export type Req = Tables<"service_requests">;

export const REQUEST_STATUS: Record<Req["status"], string> = {
  aberta: "Registrada — privada",
  aceita: "Aceita — registro antigo",
  recusada: "Recusada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function RequestCard({ r, children, shared = false, id }: { r: Req; children?: React.ReactNode; shared?: boolean; id?: string }) {
  return (
    <li id={id} className="scroll-mt-24 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-card-foreground">{r.title}</p>
          <p className="text-sm text-muted-foreground">
            {r.category} · {r.city}{r.region ? ` · ${r.region}` : ""} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-2 text-sm text-card-foreground">{r.description}</p>
        </div>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">{shared && r.status === "aberta" ? "Compartilhada com o técnico" : REQUEST_STATUS[r.status]}</span>
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </li>
  );
}
