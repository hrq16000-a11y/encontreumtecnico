import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilianPhone } from "@/lib/brazilian-phone";

const db = supabase as unknown as SupabaseClient;

/** Opt-in SMS confirmation. Typed phone is never used as proof; GoTrue must
 * confirm the phone change before the private native pre-registration RPC runs.
 */
export function PioneerPhoneVerification({ userId }: { userId: string }) {
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const [phone, setPhone] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPhone("");
    setPendingPhone(null);
    setOtp("");
    setBusy(false);
    setMessage(null);
  }, [userId]);

  async function requestCode() {
    const normalized = normalizeBrazilianPhone(phone);
    if (!normalized || normalized.length !== 14) {
      setMessage("Para receber SMS, informe um celular brasileiro de 11 dígitos com DDD. Telefones fixos podem ser recuperados pelo e-mail ou solicitação manual.");
      return;
    }
    const owner = userId;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ phone: normalized });
      if (ownerRef.current !== owner) return;
      if (error) {
        setMessage("A verificação SMS não está disponível ou foi recusada. Use a recuperação manual do cadastro antigo.");
      } else {
        setPendingPhone(normalized);
        setMessage("Um código foi solicitado para o seu celular. Informe o código recebido; ainda não houve associação de cadastro.");
      }
    } catch {
      if (ownerRef.current === owner) setMessage("Não foi possível solicitar o código. Nenhum cadastro foi associado.");
    } finally {
      if (ownerRef.current === owner) setBusy(false);
    }
  }

  async function confirmCode() {
    if (!pendingPhone || !/^\d{6}$/.test(otp.trim())) {
      setMessage("Informe o código SMS de 6 dígitos.");
      return;
    }
    const owner = userId;
    setBusy(true);
    setMessage(null);
    try {
      const verified = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: otp.trim(),
        type: "phone_change",
      });
      if (ownerRef.current !== owner) return;
      if (verified.error) {
        setMessage("O código não foi confirmado. Nenhum pré-cadastro foi vinculado.");
        return;
      }
      // The server reads phone_confirmed_at from auth.users, not the
      // browser's phone input. It rejects ambiguous or unverified matches.
      const { data, error } = await db.rpc("eut_claim_my_pioneer_pre_registration");
      if (ownerRef.current !== owner) return;
      if (error) {
        setMessage("Celular confirmado, mas não foi possível conferir seu histórico agora.");
      } else if (data?.state === "vinculado") {
        setMessage("Identidade confirmada. Pré-cadastro pioneiro associado quando a correspondência era inequívoca. Complete seu perfil profissional para publicar.");
      } else if (data?.state === "revisao_necessaria") {
        setMessage("O cadastro antigo requer análise de titularidade. Nenhuma associação automática foi realizada.");
      } else {
        setMessage("Celular confirmado. Você pode continuar o cadastro novo; caso tenha um registro antigo, solicite a recuperação manual.");
      }
      setPendingPhone(null);
      setOtp("");
    } catch {
      if (ownerRef.current === owner) setMessage("Falha ao confirmar o número. Nenhuma associação foi presumida.");
    } finally {
      if (ownerRef.current === owner) setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-amber-700/25 bg-card p-5" aria-label="Recuperar pré-cadastro pioneiro">
      <h2 className="text-lg font-semibold text-card-foreground">Pioneiro Bronze · recuperar meu pré-cadastro</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Já participava da comunidade ou do portal antigo? Confirme um celular que ainda lhe pertence.
        O número só será conferido no banco privado após confirmação por SMS.
        Correspondências ambíguas precisam de revisão; o selo Bronze não certifica qualificação.
      </p>
      {!pendingPhone ? (
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-medium text-foreground">
            Seu celular com DDD
            <input type="tel" autoComplete="tel-national" inputMode="tel" maxLength={40}
              value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy}
              placeholder="Ex.: (41) 99999-8888"
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground" />
          </label>
          <button type="button" disabled={busy} onClick={() => void requestCode()}
            className="min-h-11 rounded-md border border-amber-700/50 px-4 text-sm font-semibold text-foreground disabled:opacity-60">
            {busy ? "Solicitando código…" : "Enviar código de confirmação por SMS"}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-medium text-foreground">
            Código recebido por SMS
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} disabled={busy}
              className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base tracking-widest text-foreground" />
          </label>
          <button type="button" onClick={() => void confirmCode()} disabled={busy || otp.length !== 6}
            className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Confirmando…" : "Confirmar número e procurar pré-cadastro"}
          </button>
          <button type="button" disabled={busy} onClick={() => { setPendingPhone(null); setOtp(""); }}
            className="min-h-11 text-sm text-primary underline">Trocar número</button>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        O envio do SMS só acontece após seu clique e depende de um provedor de SMS habilitado.
        Sem essa confirmação, o número digitado não vincula nenhum histórico.
      </p>
    </section>
  );
}
