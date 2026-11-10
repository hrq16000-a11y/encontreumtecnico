import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type LegacyAccount = {
  legacy_name: string;
  intended_type: "tecnico" | "cliente";
  directory_profiles: number;
  activation_state: "aguardando_titular" | "vinculada" | "revisao_manual";
};

const db = supabase as unknown as SupabaseClient;

/**
 * The imported WordPress account is a private staging record, not an Auth user.
 * Its owner opts in to link it after verified identity and role checks on the DB.
 * This component never reads/imports credentials or private contact information.
 */
export function LegacyAccountActivation({
  userId, role,
}: { userId: string; role: "tecnico" | "cliente" }) {
  const [record, setRecord] = useState<LegacyAccount | null>(null);
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  // Synchronous render guard: never show another account's private legacy match.
  const activeOwnerId = useRef(userId);
  activeOwnerId.current = userId;
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [lookupAttempt, setLookupAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setRecord(null);
    setLoadedOwnerId(null);
    setFeedback(null);
    setBusy(false);
    setLookupFailed(false);
    void Promise.resolve(db.rpc("eut_my_legacy_account")).then(({ data, error }) => {
      if (!mounted || activeOwnerId.current !== userId) return;
      if (!error && Array.isArray(data)) {
        setRecord((data[0] as LegacyAccount | undefined) ?? null);
      } else {
        // A failed lookup is NOT evidence that the WordPress account is absent.
        setRecord(null);
        setLookupFailed(true);
      }
      setLoadedOwnerId(userId);
      setLoading(false);
    }).catch(() => {
      if (!mounted || activeOwnerId.current !== userId) return;
      setRecord(null);
      setLookupFailed(true);
      setLoadedOwnerId(userId);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [userId, lookupAttempt]);

  async function linkAccount() {
    if (busy || !record || loadedOwnerId !== userId ||
        activeOwnerId.current !== userId || record.intended_type !== role) return;
    const requestedOwnerId = userId;
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await db.rpc("eut_confirm_my_legacy_account");
      if (activeOwnerId.current !== requestedOwnerId) return;
      if (error) {
        setFeedback("Não foi possível verificar o vínculo. Confira a confirmação do e-mail ou solicite revisão pelo suporte.");
      } else if (data?.state === "vinculada") {
        setRecord((previous) => previous ? { ...previous, activation_state: "vinculada" } : previous);
        setFeedback(`Conta antiga associada. ${data.profiles_linked ?? 0} perfil(is) profissional(is) recuperado(s) automaticamente. Confira seus dados abaixo.`);
      } else if (data?.state === "papel_divergente") {
        setFeedback("O tipo de conta atual não corresponde ao cadastro antigo. Solicite revisão administrativa.");
      } else {
        setFeedback("Não encontramos uma correspondência segura. Confira o e-mail utilizado.");
      }
    } catch {
      if (activeOwnerId.current === requestedOwnerId) {
        setFeedback("Não foi possível concluir agora. Tente novamente.");
      }
    } finally {
      if (activeOwnerId.current === requestedOwnerId) setBusy(false);
    }
  }

  if (loading || loadedOwnerId !== userId) return null;
  if (lookupFailed) return (
    <section className="mt-5 rounded-lg border border-destructive/40 bg-card p-5" role="alert" aria-label="Consulta do WordPress indisponível">
      <p className="text-sm text-foreground">
        Não conseguimos consultar seu cadastro WordPress agora. Isso não significa que ele foi perdido.
        Nenhuma associação foi feita.
      </p>
      <button
        type="button"
        onClick={() => setLookupAttempt((n) => n + 1)}
        className="mt-3 min-h-11 rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary"
      >
        Tentar consultar novamente
      </button>
    </section>
  );
  if (!record) return null;

  const sameRole = record.intended_type === role;
  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-5" aria-label="Recuperar conta WordPress">
      <h2 className="text-lg font-semibold text-card-foreground">Sua conta do portal anterior</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Encontramos um cadastro antigo associado à identidade verificada desta conta:
        {" "}<strong className="text-foreground">{record.legacy_name}</strong>.
        {" "}Nenhuma senha antiga foi transferida.
      </p>
      {!sameRole ? (
        <p className="mt-3 text-sm text-foreground" role="status">
          Seu registro anterior pertence a outro tipo de conta. A associação precisa de revisão; não faremos a mudança automática de papel.
        </p>
      ) : record.activation_state === "vinculada" ? (
        <p className="mt-3 text-sm text-foreground" role="status">Conta WordPress associada com sucesso.</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void linkAccount()}
          className="mt-4 min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Verificando…" : "Associar minha conta antiga"}
        </button>
      )}
      {sameRole && role === "tecnico" && record.directory_profiles > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Os perfis antigos da sua autoria são associados pelo e-mail confirmado. Confirme a região e os serviços para publicar seu perfil atual.{" "}
          <Link to="/reivindicar-cadastro" className="font-medium text-primary underline">
            Conferir os perfis WordPress
          </Link>
        </p>
      )}
      {feedback && <p className="mt-3 text-sm text-foreground" role="status">{feedback}</p>}
    </section>
  );
}
