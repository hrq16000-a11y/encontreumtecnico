import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell } from "../components/page-placeholder";
import { signInWithGoogle, useAuth, type Role } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { safeLegacyClaimReturnPath } from "@/lib/legacy-claim-validation";
import { authReturnUrl } from "@/lib/auth-domain";
import { clearOAuthErrorParams, hasOAuthCallbackError } from "@/lib/oauth-return-error";
import { canAttemptNewAccountRole } from "@/lib/onboarding-legacy-fallback";
import { safeLoginDestination } from "@/lib/navigation-safety";
import { ConnectedGoogleIdentity } from "@/components/connected-google-identity";
import { MemberInviteAcceptance } from "@/components/member-invite-acceptance";
import { clearSignupIntent, readSignupIntent, type SignupIntent } from "@/lib/signup-intent";
import { ArrowRight, LockKeyhole, Sparkles, UserRoundCheck, Wrench } from "lucide-react";

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
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setInfo(null);
    if (mode === "cadastrar" && !termsAccepted) return onError("Leia e aceite os Termos de Uso para criar sua conta.");
    if (mode !== "recuperar" && password.length < 6) return onError("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    if (mode === "recuperar") {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authReturnUrl("/redefinir-senha", window.location.origin),
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
          options: { emailRedirectTo: authReturnUrl("/entrar", window.location.origin) },
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
      {mode === "cadastrar" && (
        <label className="flex items-start gap-2 rounded-md border border-border p-3 text-xs leading-relaxed text-muted-foreground">
          <input type="checkbox" required checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Li e aceito os <Link to="/termos" className="font-semibold text-primary underline">Termos e condições</Link> e fui informado sobre a <Link to="/privacidade" className="font-semibold text-primary underline">Política de privacidade</Link>. Este aceite não substitui as opções de consentimento para cookies.</span>
        </label>
      )}
      <button type="submit" disabled={busy || (mode === "cadastrar" && !termsAccepted)} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
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

/** One-time per-attempt marker survives Google redirect inside the popup. */
function googlePopupNonce(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const nonce = sessionStorage.getItem("eut-google-popup-auth");
    return nonce && /^[a-f0-9]{32}$/.test(nonce) ? nonce : null;
  } catch { return null; }
}
function isGooglePopup(): boolean { return Boolean(googlePopupNonce()); }
function signalGooglePopupReturn(result: "complete" | "error") {
  const nonce = googlePopupNonce();
  if (!nonce) return;
  // This contains no session token or personal data. The opener independently
  // calls Auth to verify the session before accepting the OAuth return.
  try { localStorage.setItem(`eut-google-popup-result:${nonce}`, result); } catch { /* COOP fallback. */ }
  if (window.opener)
    window.opener.postMessage({ type: `eut:google-oauth-${result}`, nonce }, window.location.origin);
}

export function SignInPage({ lp2 = false }: { lp2?: boolean } = {}) {
  const { user, roles, loading, rolesError, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canRecoverAdmin, setCanRecoverAdmin] = useState(false);
  const [canBootstrapOwner, setCanBootstrapOwner] = useState(false);
  const [ownerCheckPending, setOwnerCheckPending] = useState(false);
  const [ownerCheckError, setOwnerCheckError] = useState(false);
  const [ownerLookupRetry, setOwnerLookupRetry] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signupIntent, setSignupIntent] = useState<SignupIntent | null>(null);
  const [legacyRole, setLegacyRole] = useState<"tecnico" | "cliente" | null>(null);
  const [legacyChecked, setLegacyChecked] = useState(false);
  const [legacyLookupError, setLegacyLookupError] = useState(false);
  const [legacyLookupRetry, setLegacyLookupRetry] = useState(0);
  const [legacyName, setLegacyName] = useState<string | null>(null);
  const [legacyProfileCount, setLegacyProfileCount] = useState(0);
  const roleKey = roles.join(",");
  const canAttemptRole = canAttemptNewAccountRole({ legacyChecked, legacyLookupError, legacyRole });
  useEffect(() => { setSignupIntent(readSignupIntent()); }, []);

  useEffect(() => {
    if (hasOAuthCallbackError(window.location.search, window.location.hash)) {
      setError("O login com Google não foi concluído. Nenhuma conta antiga foi alterada. Tente entrar novamente.");
      // Errors may arrive in query or fragment. Preserve unrelated state.
      if (isGooglePopup()) signalGooglePopupReturn("error");
      window.history.replaceState(window.history.state, "", clearOAuthErrorParams(window.location));
      if (isGooglePopup()) window.close();
    }
  }, []);

  useEffect(() => {
    if (loading || !user || roles.length > 0) { setCanRecoverAdmin(false); return; }
    let active = true;
    const client = supabase as unknown as SupabaseClient;
    void Promise.resolve(client.rpc("eut_can_bootstrap_legacy_admin")).then(({ data, error }) => {
      if (active) setCanRecoverAdmin(!error && data === true);
    }).catch(() => { if (active) setCanRecoverAdmin(false); });
    return () => { active = false; };
  }, [loading, user?.id, roles.length]);

  // This is a separate, one-time project-owner path. Eligibility is checked
  // inside a guarded RPC against a private allowlist and verified Google ID.
  useEffect(() => {
    if (loading || !user || roles.length > 0) {
      setCanBootstrapOwner(false);
      setOwnerCheckPending(false);
      setOwnerCheckError(false);
      return;
    }
    let active = true;
    setOwnerCheckPending(true);
    setOwnerCheckError(false);
    setCanBootstrapOwner(false);
    const client = supabase as unknown as SupabaseClient;
    void Promise.resolve(client.rpc("eut_can_bootstrap_project_owner")).then(({ data, error }) => {
      if (!active) return;
      setCanBootstrapOwner(!error && data === true);
      setOwnerCheckError(Boolean(error));
      setOwnerCheckPending(false);
    }).catch(() => {
      if (active) { setCanBootstrapOwner(false); setOwnerCheckError(true); setOwnerCheckPending(false); }
    });
    return () => { active = false; };
  }, [loading, user?.id, roles.length, ownerLookupRetry]);

  // Only the authenticated owner can query the imported WordPress role;
  // the server also checks it before granting access, regardless of UI.
  useEffect(() => {
    if (loading || !user || roles.length > 0) {
      setLegacyChecked(false);
      setLegacyLookupError(false);
      setLegacyRole(null);
      setLegacyName(null);
      setLegacyProfileCount(0);
      return;
    }
    let active = true;
    setLegacyChecked(false);
    setLegacyLookupError(false);
    setLegacyRole(null);
    setLegacyName(null);
    setLegacyProfileCount(0);
    const client = supabase as unknown as SupabaseClient;
    void Promise.resolve(client.rpc("eut_my_legacy_account")).then(({ data, error }) => {
      if (!active) return;
      if (error || !Array.isArray(data)) {
        // Fail closed: an unavailable WordPress lookup is NOT a new account.
        // Never offer the wrong role until the original type is known.
        setLegacyLookupError(true);
        setLegacyChecked(false);
        return;
      }
      const record = data[0] ?? null;
      const originalType = record?.intended_type;
      setLegacyRole(originalType === "tecnico" || originalType === "cliente" ? originalType : null);
      setLegacyName(typeof record?.legacy_name === "string" ? record.legacy_name : null);
      setLegacyProfileCount(Number.isFinite(record?.directory_profiles) ? record.directory_profiles : 0);
      setLegacyChecked(true);
    }).catch(() => {
      if (active) {
        setLegacyRole(null);
        setLegacyLookupError(true);
        setLegacyChecked(false);
      }
    });
    return () => { active = false; };
  }, [loading, user?.id, roles.length, legacyLookupRetry]);

  useEffect(() => {
    if (isGooglePopup() || loading || !user || roles.length === 0) return;
    let active = true;
    async function continueLogin() {
      // Reentrar com conta antiga já ativada também reconcilia o vínculo.
      // O servidor exige e-mail confirmado, papel idêntico e autoria original.
      if (!roles.includes("admin")) {
        try {
          const client = supabase as unknown as SupabaseClient;
          const { error } = await client.rpc("eut_confirm_my_legacy_account");
          if (error && active) setError("A associação do cadastro anterior ainda não pôde ser concluída. Sua área permanece acessível para tentar novamente.");
          // Pré-cadastros nativos: só email confirmado ou telefone validado por OTP.
          // Nunca bloqueia o login quando a associação opcional está indisponível.
          await client.rpc("eut_claim_my_pioneer_pre_registration");
        } catch {
          if (active) setError("A reconciliação da conta antiga está indisponível; tente novamente no painel.");
        }
      }
      if (!active) return;
      const stored = sessionStorage.getItem("eut-after-login");
      sessionStorage.removeItem("eut-after-login");
      // Only resume an allowed, same-origin route that matches the signed-in role.
      // A stale technician/admin target must never trap a client in the wrong panel.
      const destination = safeLoginDestination(stored, roles, lp2);
      navigate({ to: destination as "/" });
    }
    void continueLogin();
    return () => { active = false; };
  }, [loading, user?.id, roleKey, navigate, lp2]);

  // Keep the callback inside the popup. The opener re-verifies Auth before
  // granting access or resuming role / legacy-claim reconciliation.
  useEffect(() => {
    if (loading || !user || !isGooglePopup()) return;
    // COOP may remove window.opener; storage remains same-origin and correlated.
    signalGooglePopupReturn("complete");
    window.close();
  }, [loading, user?.id]);

  async function google() {
    setError(null);
    const pendingClaim = safeLegacyClaimReturnPath(sessionStorage.getItem("eut-after-login"));
    const { error } = await signInWithGoogle(pendingClaim ?? (lp2 ? "/lp2/entrar" : "/entrar"));
    if (error) setError("Não foi possível iniciar o login com Google. Tente novamente.");
  }

  async function recoverAdmin() {
    if (!termsAccepted) return setError("Leia e aceite os Termos de Uso antes de recuperar a administração.");
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

  async function bootstrapOwner() {
    if (busy || !canBootstrapOwner || !termsAccepted) return;
    setBusy(true);
    setError(null);
    try {
      const client = supabase as unknown as SupabaseClient;
      const { data, error } = await client.rpc("eut_bootstrap_project_owner");
      if (error || data !== "admin_ativado") {
        setError("Não foi possível ativar a administração com esta identidade Google. Nenhum perfil foi transferido.");
      } else {
        await refreshRoles();
      }
    } catch {
      setError("Falha de conexão na ativação administrativa. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmLegacy() {
    if (busy || !user || !legacyRole || !legacyChecked) return;
    if (!termsAccepted) {
      setError("Aceite os Termos e condições antes de recuperar a conta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = supabase as unknown as SupabaseClient;
      const { data, error } = await client.rpc("eut_confirm_my_legacy_account");
      if (error || !data || data.state !== "vinculada" || data.intended_type !== legacyRole) {
        setError("Não foi possível concluir o vínculo automático. Confira o e-mail confirmado ou solicite ajuda.");
        return;
      }
      await refreshRoles();
    } catch {
      setError("Ocorreu uma falha na associação. Tente novamente sem criar outro cadastro.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(role: Role) {
    if (busy || !canAttemptRole || (role !== "tecnico" && role !== "cliente")) return;
    if (!termsAccepted) return setError("Leia e aceite os Termos de Uso antes de escolher o tipo de conta.");
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("choose_account_type", { _role: role });
      if (error) {
        setError("O servidor recusou a escolha. Confirme sua identidade ou procure a recuperação manual se houver uma conta antiga vinculada a outra pessoa.");
      } else {
        clearSignupIntent();
        await refreshRoles();
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-xl md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <aside className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.22_0.06_258)] via-[oklch(0.30_0.09_252)] to-[oklch(0.42_0.12_235)] p-7 text-white sm:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Seu portal de serviços
            </span>
            <h2 className="mt-8 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Tudo em um só lugar. Do cadastro ao atendimento.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/90 sm:text-base">
              Uma experiência para técnicos e clientes. Entre, complete seus dados e acesse seu painel sem depender do antigo WordPress.
            </p>
            <div className="mt-8 grid gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/10 p-4">
                <UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
                <div><strong className="block text-sm text-white">Cadastro inteligente</strong>
                  <p className="mt-1 text-xs leading-5 text-white/85">O Google pode fornecer nome, e-mail e foto para uso privado, com sua autorização.</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/10 p-4">
                <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
                <div><strong className="block text-sm text-white">Painel por função</strong>
                  <p className="mt-1 text-xs leading-5 text-white/85">Ferramentas de cada conta permanecem protegidas por permissões no servidor.</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/10 p-4">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
                <div><strong className="block text-sm text-white">Dados privados</strong>
                  <p className="mt-1 text-xs leading-5 text-white/85">A foto do Google não vira automaticamente a foto pública do técnico.</p></div>
              </div>
            </div>
          </aside>
          <div className="flex min-w-0 flex-col items-center px-6 py-9 text-center sm:px-10 sm:py-12">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Entre na sua conta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Técnicos e clientes acessam com Google ou e-mail e senha.
            </p>
            {signupIntent && <p className="mt-4 w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm font-semibold text-primary" role="status">
              Você iniciou o cadastro como {signupIntent === "tecnico" ? "técnico" : "cliente"}.
              Após entrar, confirme a função para abrir seu painel.
            </p>}
            <button
              type="button"
              onClick={google}
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-4 py-3 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className="font-extrabold text-[20px] text-[#4285F4]">G</span> Entrar com Google
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-left text-sm text-muted-foreground">
              <strong className="text-foreground">Já tinha conta no WordPress?</strong>{" "}
              Cadastre-se com o mesmo e-mail ou entre com Google. A senha antiga não foi transferida.
              Após confirmar o e-mail, o sistema identifica o tipo da sua conta antiga e permite recuperá-la, junto com os perfis da sua autoria, sem digitar IDs.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Responsável pelo portal? Entre com sua conta Google autorizada e confirme a administração na próxima tela.</p>
            <EmailPasswordForm onError={setError} />
            <Link to="/ajuda-acesso" className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Problemas para entrar ou se cadastrar? Solicite ajuda
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Como você vai usar o portal?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Identificamos sua sessão. Confira os dados abaixo e escolha sua função uma única vez.</p>
            <ConnectedGoogleIdentity user={user} />
            {signupIntent && <p className="mt-4 w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-sm text-foreground">
              Sua escolha inicial: <strong>{signupIntent === "tecnico" ? "técnico/prestador" : "cliente"}</strong>.
              Confirme abaixo. Esta indicação não libera permissões sem validação no servidor.
            </p>}
            {rolesError && (
              <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-muted/40 p-4 text-left">
                <p className="text-sm text-foreground">Não conseguimos carregar suas permissões. Seu cadastro não foi alterado.</p>
                <button type="button" onClick={() => void refreshRoles()}
                  className="mt-3 min-h-10 rounded-md border border-primary px-3 text-sm font-semibold text-primary">
                  Recarregar minha área
                </button>
              </div>
            )}
            {!rolesError && !legacyChecked && !legacyLookupError && <p className="mt-4 text-sm text-muted-foreground">Verificando seu cadastro anterior…</p>}
            {legacyLookupError && (
              <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-muted/40 p-4 text-left">
                <p className="text-sm text-foreground">
                  Não foi possível consultar seus dados históricos neste momento. Se esta é sua primeira conta, você pode tentar o cadastro abaixo: o servidor verificará identidade, papel anterior e titularidade antes de autorizar. Se você já tinha cadastro, tente consultar novamente para recuperá-lo sem duplicação.
                </p>
                <button type="button" onClick={() => setLegacyLookupRetry((n) => n + 1)}
                  className="mt-3 min-h-10 rounded-md border border-primary px-3 text-sm font-semibold text-primary">
                  Tentar consultar novamente
                </button>
              </div>
            )}
            {ownerCheckPending && <p className="mt-4 text-sm text-muted-foreground">Conferindo se esta conta possui autorização administrativa…</p>}
            {ownerCheckError && (
              <div role="alert" className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
                Não foi possível conferir a recuperação administrativa. Nenhum tipo de conta foi escolhido.
                <button type="button" className="mt-2 block text-primary underline" onClick={() => setOwnerLookupRetry(n => n + 1)}>
                  Tentar verificação novamente
                </button>
              </div>
            )}
            {canBootstrapOwner && <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-left text-sm text-foreground" role="status">
              Administração do novo portal disponível para esta conta Google verificada. A conta histórica permanece preservada e poderá ser conciliada separadamente.
            </p>}
            {legacyRole && !canBootstrapOwner && !ownerCheckPending && !ownerCheckError && <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-left text-sm text-foreground" role="status">
              Encontramos a conta antiga <strong>{legacyName || "WordPress"}</strong>, do tipo <strong>{legacyRole === "tecnico" ? "técnico/prestador" : "cliente/contratante"}</strong>, associada ao seu e-mail confirmado.
              {legacyRole === "tecnico" && <span> Há {legacyProfileCount} ficha(s) profissional(is) no histórico. Ao confirmar, vamos associar automaticamente as fichas da sua autoria, sem divulgar contatos privados. Depois você confere cidade e serviços.</span>}
            </p>}
            <label className="mt-6 flex items-start gap-2 rounded-md border border-border bg-card p-3 text-left text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" required checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Li e aceito os <Link to="/termos" className="font-medium text-primary underline">Termos e condições</Link> e tomei conhecimento da <Link to="/privacidade" className="font-medium text-primary underline">Política de privacidade</Link>.</span>
            </label>
            {!rolesError && <MemberInviteAcceptance userId={user.id} termsAccepted={termsAccepted} refreshRoles={refreshRoles} />}
            <div className="mt-5 grid w-full gap-3">
              {canBootstrapOwner ? (
                <button type="button" disabled={busy || !termsAccepted || rolesError} onClick={() => void bootstrapOwner()}
                  className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {busy ? "Ativando acesso…" : "Ativar administração do novo portal"}
                </button>
              ) : legacyRole ? (
                <>
                  <button type="button" disabled={busy || !termsAccepted || !legacyChecked || rolesError || ownerCheckPending || ownerCheckError}
                    onClick={() => void confirmLegacy()}
                    className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    {busy ? "Associando cadastro anterior…" : "Confirmo meus dados — recuperar conta e perfis"}
                  </button>
                  <p className="mt-2 text-left text-xs text-muted-foreground">
                    Seu tipo antigo é apenas referência. Você também pode escolher uma função diferente no portal novo,
                    sem importar automaticamente profissão, contatos, categorias ou permissão da conta anterior.
                  </p>
                  <button type="button" disabled={busy || !canAttemptRole || !termsAccepted || rolesError || ownerCheckPending || ownerCheckError}
                    onClick={() => choose("tecnico")}
                    className="min-h-11 rounded-md border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-60">
                    Técnico com regras atuais
                  </button>
                  <button type="button" disabled={busy || !canAttemptRole || !termsAccepted || rolesError || ownerCheckPending || ownerCheckError}
                    onClick={() => choose("cliente")}
                    className="min-h-11 rounded-md border border-input px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60">
                    Cliente com regras atuais
                  </button>
                </>
              ) : (
                <>
                  <button disabled={busy || !canAttemptRole || !termsAccepted || rolesError || ownerCheckPending || ownerCheckError} onClick={() => choose("tecnico")} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                    Sou técnico — quero oferecer serviços
                  </button>
                  <button disabled={busy || !canAttemptRole || !termsAccepted || rolesError || ownerCheckPending || ownerCheckError} onClick={() => choose("cliente")} className="min-h-11 rounded-md border border-input px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-60">
                    Sou cliente — quero contratar
                  </button>
                </>
              )}
              {canRecoverAdmin && (
                <button type="button" disabled={busy || !termsAccepted} onClick={() => void recoverAdmin()}
                  className="min-h-11 rounded-md border border-primary px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-60">
                  Recuperar administração do portal anterior
                </button>
              )}
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
