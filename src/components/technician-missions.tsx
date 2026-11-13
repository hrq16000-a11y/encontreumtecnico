import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
const STORAGE_KEY = "eut-pending-technician-invite";
const CODE_PATTERN = /^[0-9a-f]{32}$/;

/** Never turn a missing or malformed backend counter into a fictional zero. */
function verifiedCount(value: unknown): number | null {
  const count = typeof value === "number" ? value
    : typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

type MissionDashboard = {
  code: string;
  profile_published: boolean;
  online_recent: boolean;
  invited_accounts: number;
  invited_public_profiles: number;
};

const claimMessages: Record<string, string> = {
  registrado: "Convite associado à sua conta de técnico. Obrigado por participar!",
  ja_registrado: "Este convite já está associado à sua conta.",
  convite_ja_vinculado: "Sua conta já está vinculada a outro convite. Não é possível trocar a indicação.",
  codigo_invalido: "O convite não foi encontrado ou não é válido.",
  codigo_indisponivel: "Este convite não está mais disponível.",
  autoindicacao_bloqueada: "Não é possível usar seu próprio convite.",
  prazo_encerrado: "O prazo de associação do convite terminou. A participação na rede continua gratuita.",
};

export function TechnicianMissions({ userId, compact = false, onOpenDetails }: {
  userId: string;
  compact?: boolean;
  onOpenDetails?: () => void;
}) {
  const [dashboard, setDashboard] = useState<MissionDashboard | null>(null);
  const [link, setLink] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const { data, error } = await db.rpc("eut_my_referral_dashboard");
    const invitedAccounts = verifiedCount(data?.invited_accounts);
    const invitedPublicProfiles = verifiedCount(data?.invited_public_profiles);
    if (error || !data || typeof data.code !== "string" || !CODE_PATTERN.test(data.code)
      || invitedAccounts === null || invitedPublicProfiles === null) {
      throw new Error("Unable to load missions");
    }
    const summary: MissionDashboard = {
      code: data.code,
      profile_published: data.profile_published === true,
      online_recent: data.online_recent === true,
      invited_accounts: invitedAccounts,
      invited_public_profiles: invitedPublicProfiles,
    };
    setDashboard(summary);
    setLink(`${window.location.origin}/convite/${summary.code}`);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDashboard(null);
    setMessage(null);
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setPendingCode(stored && CODE_PATTERN.test(stored) ? stored : null);
    void Promise.resolve(db.rpc("eut_my_referral_dashboard")).then(({ data, error }) => {
      if (!active) return;
      const invitedAccounts = verifiedCount(data?.invited_accounts);
      const invitedPublicProfiles = verifiedCount(data?.invited_public_profiles);
      if (error || !data || typeof data.code !== "string" || !CODE_PATTERN.test(data.code)
        || invitedAccounts === null || invitedPublicProfiles === null) {
        setMessage("Não foi possível carregar as missões. Tente atualizar o painel.");
      } else {
        setDashboard({
          code: data.code,
          profile_published: data.profile_published === true,
          online_recent: data.online_recent === true,
          invited_accounts: invitedAccounts,
          invited_public_profiles: invitedPublicProfiles,
        });
        setLink(`${window.location.origin}/convite/${data.code}`);
      }
      setLoading(false);
    }).catch(() => {
      if (active) {
        setMessage("A central de missões está temporariamente indisponível.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId]);

  async function acceptInvitation() {
    if (!pendingCode || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data, error } = await db.rpc("eut_accept_technician_invite", { _code: pendingCode });
      if (error || typeof data !== "string") {
        setMessage("Não foi possível associar o convite. Tente novamente.");
        return;
      }
      setMessage(claimMessages[data] ?? "Não foi possível concluir a associação deste convite.");
      if (data in claimMessages) {
        sessionStorage.removeItem(STORAGE_KEY);
        setPendingCode(null);
      }
      await refresh();
    } catch {
      setMessage("Não foi possível validar o convite agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link de indicação copiado.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione o endereço abaixo para copiar.");
    }
  }

  function rejectInvitation() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPendingCode(null);
    setMessage("Convite descartado. Seu cadastro permanece gratuito.");
  }

  if (compact) {
    return (
      <section className="mt-5 rounded-xl border border-primary/20 bg-muted/20 p-4 sm:p-5" aria-label="Resumo de indicações do técnico">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Meu link de indicação</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Convide outros técnicos gratuitamente e acompanhe as indicações confirmadas.
            </p>
          </div>
          <a href="#eut-tecnico-indicacoes" onClick={onOpenDetails}
            className="inline-flex min-h-11 items-center rounded-lg border border-primary/30 px-3 py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Ver detalhes das indicações <span aria-hidden="true" className="ml-2">→</span>
          </a>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">Carregando suas indicações…</p>
        ) : dashboard ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <strong className="block text-2xl font-bold tabular-nums text-foreground">{dashboard.invited_accounts}</strong>
                <span className="text-xs text-muted-foreground">Técnicos que aceitaram seu convite</span>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <strong className="block text-2xl font-bold tabular-nums text-foreground">{dashboard.invited_public_profiles}</strong>
                <span className="text-xs text-muted-foreground">Indicados com perfil publicado</span>
              </div>
            </div>
            <label htmlFor="eut-link-indicacao-resumo" className="mt-4 block text-sm font-semibold text-foreground">
              Seu link exclusivo para compartilhar
            </label>
            <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input id="eut-link-indicacao-resumo" aria-label="Meu link exclusivo de indicação"
                readOnly value={link} onFocus={(e) => e.currentTarget.select()}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground" />
              <button type="button" onClick={() => void copyLink()} disabled={!link}
                className="min-h-11 shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                Copiar link
              </button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-foreground" role="alert">
            Indicações indisponíveis no momento. Abra os detalhes para tentar novamente.
          </p>
        )}
        {message && <p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Indicações qualificadas podem gerar destaque regional; não há bônus financeiro ou comissão automática nesta etapa.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5" aria-label="Minhas missões e convites">
      <h2 className="text-lg font-semibold text-card-foreground">Minhas missões e indicações</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Participe para manter suas informações atualizadas e colaborar com a rede. As missões
        são voluntárias: não há mensalidade, obrigação de convidar pessoas ou pagamento para aparecer.
      </p>
      {loading ? <p className="mt-4 text-sm text-muted-foreground">Carregando missões…</p> : dashboard && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">Perfil completo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dashboard.profile_published ? "Perfil publicado" : "Complete cidade e serviços para publicar"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">Presença no painel</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dashboard.online_recent ? "Online recentemente" : "Offline — ative a disponibilidade quando puder atender"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">Convidar técnicos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dashboard.invited_accounts} indicação(ões) associada(s);
                {" "}{dashboard.invited_public_profiles} com perfil público
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="text-sm font-semibold text-foreground">Recompensa: destaque na busca</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Após duas indicações de técnicos que publicarem seus próprios perfis,
              seu cadastro recebe o selo Destaque por indicações e prioridade apenas
              entre profissionais da mesma região e disponibilidade. Serviço compatível
              e localização vêm primeiro. Não existe bônus financeiro.
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {dashboard.invited_public_profiles >= 2
                ? "Destaque habilitado para perfil publicado."
                : `Progresso: ${dashboard.invited_public_profiles} de 2 perfis indicados e publicados.`}
            </p>
          </div>
          <div className="mt-5 rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Seu link exclusivo de indicação</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Convide somente pessoas interessadas em prestar serviços. O crédito de indicação
              é registrado uma vez por novo técnico; só consideramos perfil público quando ele
              completar o próprio cadastro. Não envie mensagens indesejadas.
            </p>
            <input aria-label="Meu link de indicação" readOnly value={link} onFocus={(e) => e.currentTarget.select()}
              className="mt-3 min-h-11 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyLink()} disabled={!link || saving}
                className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                Copiar link
              </button>
              <button type="button" disabled={saving} onClick={() => void refresh().then(() => setMessage("Missões atualizadas.")).catch(() => setMessage("Não foi possível atualizar agora."))}
                className="min-h-11 rounded-md border border-input px-4 py-2 text-sm font-semibold text-foreground">
                Atualizar missões
              </button>
            </div>
          </div>
        </>
      )}
      {pendingCode && (
        <div className="mt-5 rounded-lg border border-primary/30 bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground">Você chegou por um convite?</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Confirme a associação somente se recebeu esse convite de um prestador. A indicação
            não altera seus preços, sua autonomia, sua visibilidade nem os dados do WordPress.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void acceptInvitation()} disabled={saving || loading}
              className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? "Associando…" : "Confirmar convite recebido"}
            </button>
            <button type="button" onClick={rejectInvitation} disabled={saving}
              className="min-h-11 rounded-md border border-input px-3 py-2 text-sm font-semibold text-foreground">
              Não aceitar
            </button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-4 text-sm text-foreground">{message}</p>}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Proximidade e serviço compatível continuam mais importantes que indicações. Esta etapa
        apenas mostra seu progresso; não existe bônus financeiro, certificação ou posição garantida.
      </p>
    </section>
  );
}
