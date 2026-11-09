import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell } from "../components/page-placeholder";
import { signInWithGoogle, useAuth, type Role } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Entrar — Encontre um Técnico" },
      { name: "description", content: "Acesse sua conta de técnico ou cliente com Google ou e-mail e senha." },
      { property: "og:title", content: "Entrar — Encontre um Técnico" },
      { property: "og:description", content: "Acesse sua conta de técnico ou cliente com Google ou e-mail e senha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignInPage,
});

function EmailPasswordForm({ onError }: { onError: (m: string | null) => void }) {
  const [mode, setMode] = useState<"entrar" | "cadastrar" | "recuperar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setInfo(null);
    if (mode !== "recuperar" && password.length < 6) return onError("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    if (mode === "recuperar") {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) onError("Não foi possível enviar a recuperação agora. Tente novamente.");
        else setInfo("Se houver uma conta com este e-mail, você receberá instruções para redefinir sua senha.");
      } catch {
        onError("Falha de conexão. Tente novamente.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      if (mode === "cadastrar") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/entrar` },
        });
        if (error) {
          onError(error.message.includes("registered") ? "Este e-mail já tem conta. Use Entrar." : "Não foi possível criar a conta.");
          return;
        }
        if (!data.session) setInfo("Se o cadastro puder ser realizado, verifique seu e-mail para confirmar o acesso.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) onError("Não foi possível entrar. Verifique o e-mail, a senha e se a conta foi confirmada.");
      }
    } catch {
      onError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const input = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  return (
    <form onSubmit={submit} className="mt-6 grid w-full gap-3 text-left">
      <div className="text-center text-xs text-muted-foreground">ou com e-mail e senha</div>
      <label className="grid gap-1 text-sm text-foreground">
        E-mail
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </label>
      {mode !== "recuperar" && <label className="grid gap-1 text-sm text-foreground">
        Senha
        <input type="password" required minLength={6} autoComplete={mode === "cadastrar" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </label>}
      <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {mode === "recuperar" ? "Enviar instruções" : mode === "cadastrar" ? "Criar conta" : "Entrar"}
      </button>
      {mode !== "recuperar" && <button type="button" onClick={() => setMode(mode === "entrar" ? "cadastrar" : "entrar")} className="text-sm text-primary underline-offset-4 hover:underline">
        {mode === "entrar" ? "Não tem conta? Cadastre-se (técnico ou cliente)" : "Já tem conta? Entrar"}
      </button>}
      <button type="button" onClick={() => { setMode(mode === "recuperar" ? "entrar" : "recuperar"); setInfo(null); onError(null); }} className="text-sm text-primary underline-offset-4 hover:underline">
        {mode === "recuperar" ? "Voltar ao login" : "Esqueci minha senha"}
      </button>
      {info && <p className="text-sm text-muted-foreground">{info}</p>}
    </form>
  );
}

function SignInPage() {
  const { user, roles, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canRecoverAdmin, setCanRecoverAdmin] = useState(false);

  useEffect(() => {
    if (loading || !user || roles.length > 0) { setCanRecoverAdmin(false); return; }
    let active = true;
    const client = supabase as unknown as SupabaseClient;
    void client.rpc("eut_can_bootstrap_legacy_admin").then(({ data, error }) => {
      if (active) setCanRecoverAdmin(!error && data === true);
    }).catch(() => { if (active) setCanRecoverAdmin(false); });
    return () => { active = false; };
  }, [loading, user?.id, roles.length]);

  useEffect(() => {
    if (loading || !user || roles.length === 0) return;
    const stored = sessionStorage.getItem("eut-after-login");
    sessionStorage.removeItem("eut-after-login");
    if (stored && stored !== "/entrar") navigate({ to: stored as "/" });
    else if (roles.includes("admin")) navigate({ to: "/admin" });
    else if (roles.includes("tecnico")) navigate({ to: "/area-tecnico" });
    else navigate({ to: "/area-cliente" });
  }, [loading, user, roles, navigate]);

  async function google() {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) setError("Não foi possível iniciar o login com Google. Tente novamente.");
  }

  async function recoverAdmin() {
    setBusy(true);
    setError(null);
    try {
      const client = supabase as unknown as SupabaseClient;
      const { data, error } = await client.rpc("eut_bootstrap_legacy_admin");
      if (error || data !== "admin_ativado") setError("Não foi possível recuperar este acesso administrativo. Solicite revisão de titularidade.");
      else await refreshRoles();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(role: Role) {
    setBusy(true);
    const { error } = await supabase.rpc("choose_account_type", { _role: role });
    setBusy(false);
    if (error) setError("Não foi possível salvar o tipo de conta.");
    else refreshRoles();
  }

  return (
    <PageShell>
      <section className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Entre na sua conta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Técnicos e clientes acessam com Google ou e-mail e senha.
            </p>
            <button
              type="button"
              onClick={google}
              className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Entrar com Google
            </button>
            <p className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-left text-sm text-muted-foreground">
              <strong className="text-foreground">Já tinha conta no WordPress?</strong>{" "}
              Cadastre-se com o mesmo e-mail ou entre com Google. A senha antiga não foi transferida.
              Após confirmar seu e-mail, escolha seu tipo de conta. Técnicos podem solicitar a recuperação do perfil anterior.
            </p>
            <EmailPasswordForm onError={setError} />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Como você vai usar o portal?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Escolha uma vez; isso define sua área.</p>
            <div className="mt-8 grid w-full gap-3">
              <button disabled={busy} onClick={() => choose("tecnico")} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                Sou técnico — quero oferecer serviços
              </button>
              <button disabled={busy} onClick={() => choose("cliente")} className="min-h-11 rounded-md border border-input px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-60">
                Sou cliente — quero contratar
              </button>
              {canRecoverAdmin && (
                <button type="button" disabled={busy} onClick={() => void recoverAdmin()}
                  className="min-h-11 rounded-md border border-primary px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-60">
                  Recuperar administração do portal anterior
                </button>
              )}
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </section>
    </PageShell>
  );
}
