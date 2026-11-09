import { useEffect, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void db.rpc("eut_my_legacy_account").then(({ data, error }) => {
      if (!mounted) return;
      if (!error && Array.isArray(data)) {
        setRecord((data[0] as LegacyAccount | undefined) ?? null);
      } else {
        setRecord(null);
      }
      setLoading(false);
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [userId]);

  async function linkAccount() {
    if (busy || !record || record.intended_type !== role) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await db.rpc("eut_link_my_legacy_account");
      if (error) {
        setFeedback("Não foi possível verificar o vínculo. Confira a confirmação do e-mail ou solicite revisão pelo suporte.");
      } else if (data === "vinculada" || data === "ja_vinculada") {
        setRecord((previous) => previous ? { ...previous, activation_state: "vinculada" } : previous);
        setFeedback("Conta antiga associada à sua conta atual. Perfis profissionais ainda dependem de análise.");
      } else if (data === "papel_divergente") {
        setFeedback("O tipo de conta atual não corresponde ao cadastro antigo. Solicite revisão administrativa.");
      } else {
        setFeedback("Não encontramos uma correspondência segura. Confira o e-mail utilizado.");
      }
    } catch {
      setFeedback("Não foi possível concluir agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !record) return null;

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
          Seu perfil de técnico antigo exige aprovação separada.{" "}
          <Link to="/reivindicar-cadastro" className="font-medium text-primary underline">
            Solicitar conferência do perfil WordPress
          </Link>
        </p>
      )}
      {feedback && <p className="mt-3 text-sm text-foreground" role="status">{feedback}</p>}
    </section>
  );
}
