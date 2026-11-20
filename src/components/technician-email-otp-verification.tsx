import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

type Action = "send" | "verify";

/**
 * Confirmação de posse do e-mail sem conta duplicada, contatos ou dados
 * administrativos. A RPC rejeita sessões comuns: só um login pelo link/OTP
 * recente e pertencente ao próprio técnico pode gravar a prova privada.
 */
export function TechnicianEmailOtpVerification({ userId, email }: {
  userId: string;
  email: string;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const emailReady = Boolean(email.trim());

  async function sameAuthenticatedAccount() {
    const { data, error } = await supabase.auth.getUser();
    return !error && data.user?.id === userId &&
      data.user.email?.trim().toLowerCase() === email.trim().toLowerCase();
  }

  async function sendLink() {
    if (action || !emailReady) return;
    setFeedback(null);
    setAction("send");
    try {
      if (!await sameAuthenticatedAccount()) {
        setFeedback("Sua sessão mudou. Entre novamente na conta técnica antes de continuar.");
        return;
      }
      const { data: challenge, error: beginError } = await db.rpc("eut_begin_technician_email_otp");
      if (beginError || challenge?.ok !== true) {
        setFeedback("O servidor não iniciou a prova de e-mail. Confira a sessão e tente novamente.");
        return;
      }
      // Nunca criar outro usuário; o provedor envia o link ao e-mail da sessão.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/area-tecnico`,
        },
      });
      setFeedback(error
        ? "Não foi possível enviar o link agora. Aguarde e tente novamente nesta conta."
        : "Enviamos um link de acesso para seu e-mail. Abra-o neste navegador, volte a Meu perfil e clique em Confirmar verificação. O rascunho desta conta não foi apagado.");
    } catch {
      setFeedback("Não foi possível solicitar o link. Verifique a conexão e tente mais tarde.");
    } finally {
      setAction(null);
    }
  }

  async function confirm() {
    if (action || !emailReady) return;
    setFeedback(null);
    setAction("verify");
    try {
      if (!await sameAuthenticatedAccount()) {
        setFeedback("Este acesso não pertence à mesma conta. Entre novamente com seu e-mail original.");
        return;
      }
      const { data, error } = await db.rpc("eut_attest_technician_email_otp");
      if (error || data?.ok !== true || data.verified !== true) {
        setFeedback("A posse do e-mail ainda não foi comprovada. Abra o link recente nesta mesma conta antes de confirmar; não crie outra conta.");
        return;
      }
      setVerified(true);
      setFeedback("E-mail comprovado pelo servidor. Agora volte à revisão e publique seu cadastro.");
    } catch {
      setFeedback("Não foi possível concluir a verificação. Nenhum cadastro foi alterado.");
    } finally {
      setAction(null);
    }
  }

  return <details className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
    <summary className="min-h-10 cursor-pointer font-semibold">
      Verificar titularidade do meu e-mail para publicar
    </summary>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">
      Se o servidor ainda não reconhece a confirmação do seu e-mail, peça um link de acesso
      e abra-o nesta mesma conta. O link comprova o e-mail; não altera telefone, serviços,
      categoria nem o cadastro de outros técnicos.
    </p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={action !== null || !emailReady || verified}
        onClick={() => void sendLink()}
        className="min-h-11 rounded-lg border border-primary px-3 text-xs font-semibold text-primary disabled:opacity-60">
        {action === "send" ? "Enviando…" : "Enviar link ao meu e-mail"}
      </button>
      <button type="button" disabled={action !== null || !emailReady || verified}
        onClick={() => void confirm()}
        className="min-h-11 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {action === "verify" ? "Verificando…" : "Confirmar verificação"}
      </button>
    </div>
    {!emailReady && <p role="alert" className="mt-2 text-xs text-destructive">
      Sua sessão não possui e-mail. Entre novamente para verificar a conta.
    </p>}
    {feedback && <p role="status" className="mt-3 text-xs leading-5">{feedback}</p>}
  </details>;
}
