import { RadioTower } from "lucide-react";

/**
 * Fail closed: a public Realtime Presence channel exposes its entire aggregate
 * to any subscriber. Resume live counts only with server-enforced admin access.
 * The separate search_events activity below remains protected by its own RLS.
 */
export function AdminLivePresence() {
  return <section aria-label="Presença consentida em tempo real" className="mt-7 rounded-xl border border-border bg-card p-4 sm:p-6">
    <h2 className="flex items-center gap-2 text-lg font-bold">
      <RadioTower className="h-5 w-5 text-primary" /> Presença online
    </h2>
    <p className="mt-4 text-sm leading-6 text-muted-foreground" role="status">
      Contagem ao vivo temporariamente suspensa: a leitura de presença depende de um canal privado
      com autorização administrativa comprovada no servidor.
    </p>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      As métricas de buscas consentidas abaixo permanecem disponíveis conforme as permissões do painel.
    </p>
  </section>;
}
