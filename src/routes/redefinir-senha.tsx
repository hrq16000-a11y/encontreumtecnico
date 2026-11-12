import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PageShell } from "../components/page-placeholder";
import { useAuthDialog } from "@/components/auth-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Redefinir senha — Encontre um Técnico" },
      { name: "description", content: "Crie uma nova senha para sua conta." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [valid, setValid] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const openAuth = useAuthDialog();

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // A failed or expired callback must not be disguised by an unrelated
    // existing session, even when this browser is already logged in.
    const hasCallbackError = ["error", "error_code"].some((key) =>
      query.has(key) || fragment.has(key));
    const cameFromRecovery = query.get("type") === "recovery" ||
      fragment.get("type") === "recovery" || query.has("token_hash") ||
      query.has("code");
    setRecoveryLink(cameFromRecovery);
    setInvalidLink(hasCallbackError);
    if (hasCallbackError) {
      setChecking(false);
      return () => { active = false; };
    }

    async function verifyCurrentUser() {
      try {
        // getUser verifies the session with Auth. getSession alone only reads
        // local tokens and is not sufficient to show an active reset form.
        const { data, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        setValid(!userError && Boolean(data.user));
      } catch {
        if (active) setValid(false);
      } finally {
        if (active) setChecking(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryLink(true);
        // Supabase has authenticated the recovery link; independently verify
        // the user rather than trusting an event payload for authorization.
        void verifyCurrentUser();
      } else if (event === "SIGNED_OUT") {
        setValid(false);
        setChecking(false);
      }
    });
    void verifyCurrentUser();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!valid || checking || saving) return;
    if (password.length < 8) return setError("Use pelo menos 8 caracteres.");
    if (password !== repeat) return setError("As senhas não coincidem.");
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError("Não foi possível atualizar a senha. Solicite um novo link.");
      else {
        setDone(true);
        setPassword("");
        setRepeat("");
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold text-foreground">{recoveryLink ? "Redefinir senha" : "Alterar senha"}</h1>
        {checking ? <p className="mt-4 text-muted-foreground">Verificando link…</p>
          : done ? <div className="mt-5 space-y-4"><p role="status">Senha atualizada. Você já pode entrar no portal.</p><Link to="/entrar" className="font-medium text-primary underline">Ir para o login</Link></div>
          : invalidLink || !valid ? <div className="mt-5 space-y-4"><p role="alert">O link está inválido ou expirou, ou você precisa entrar novamente. Solicite outro e-mail para recuperar a senha.</p><button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" onClick={() => openAuth?.("recuperar")}>Solicitar novo link</button><div><Link to="/entrar" className="font-medium text-primary underline">Voltar ao login</Link></div></div>
          : <form onSubmit={submit} className="mt-5 grid gap-4">{!recoveryLink && <p className="text-sm text-muted-foreground">Você está conectado à sua conta. Para alterar a própria senha, informe uma nova senha abaixo.</p>}
              <label className="grid gap-1 text-sm font-medium">Nova senha
                <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="min-h-11 rounded-md border border-input bg-background px-3" />
              </label>
              <label className="grid gap-1 text-sm font-medium">Confirmar nova senha
                <input type="password" autoComplete="new-password" required minLength={8} value={repeat} onChange={e => setRepeat(e.target.value)} className="min-h-11 rounded-md border border-input bg-background px-3" />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <button type="submit" disabled={saving} className="min-h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">{saving ? "Salvando…" : "Salvar nova senha"}</button>
            </form>}
      </section>
    </PageShell>
  );
}
