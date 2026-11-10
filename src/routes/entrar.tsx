import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell } from "../components/page-placeholder";
import { signInWithGoogle, useAuth, type Role } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { safeLegacyClaimReturnPath } from "@/lib/legacy-claim-validation";
import { canAttemptNewAccountRole } from "@/lib/onboarding-legacy-fallback";

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
  const [legacyRole, setLegacyRole] = useState<"tecnico" | "cliente" | null>(null);
  const [legacyChecked, setLegacyChecked] = useState(false);
  const [legacyLookupError, setLegacyLookupError] = useState(false);
  const [legacyLookupRetry, setLegacyLookupRetry] = useState(0);
  const [legacyName, setLegacyName] = useState<string | null>(null);
  const [legacyProfileCount, setLegacyProfileCount] = useState(0);
  const roleKey = roles.join(",");
  const canAttemptRole = canAttemptNewAccountRole({ legacyChecked, legacyLookupError, legacyRole });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || params.has("error_code")) {
      setError("O login com Google não foi concluído. Nenhuma conta antiga foi alterada. Tente entrar novamente.");
      // An OAuth error is not a session; remove only error parameters,
      // never provider tokens or session state.
      for (const key of ["error", "error_code", "error_description"]) params.delete(key);
      const query = params.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (query ? "?" + query : ""));
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
    if (loading || !user || roles.length === 0) return;
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
      if (stored && stored !== "/entrar") navigate({ to: stored as "/" });
      else if (roles.includes("admin")) navigate({ to: lp2 ? "/lp2/admin" : "/admin" });
      else if (roles.includes("tecnico")) navigate({ to: lp2 ? "/lp2/meu-perfil" : "/area-tecnico" });
      else navigate({ to: lp2 ? "/lp2/cliente" : "/area-cliente" });
    }
    void continueLogin();
    return () => { active = false; };
  }, [loading, user?.id, roleKey, navigate, lp2]);

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
    if (legacyRole && role !== legacyRole) {
      setError("Seu cadastro WordPress já tem um tipo definido. Selecione o tipo indicado para associar sua conta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("choose_account_type", { _role: role });
      if (error) {
        setError("O servidor recusou esta escolha. Sua identidade precisa estar confirmada e, se existir uma conta anterior, o tipo original deverá ser preservado. Tente recuperar seu cadastro antigo.");
      } else {
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
              Após confirmar o e-mail, o sistema identifica o tipo da sua conta antiga e permite recuperá-la, junto com os perfis da sua autoria, sem digitar IDs.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Responsável pelo portal? Entre com sua conta Google autorizada e confirme a administração na próxima tela.</p>
            <EmailPasswordForm onError={setError} />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Como você vai usar o portal?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Escolha uma vez; isso define sua área.</p>
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
            <div className="mt-5 grid w-full gap-3">
              {canBootstrapOwner ? (
                <button type="button" disabled={busy || !termsAccepted || rolesError} onClick={() => void bootstrapOwner()}
                  className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {busy ? "Ativando acesso…" : "Ativar administração do novo portal"}
                </button>
              ) : legacyRole ? (
                <button type="button" disabled={busy || !termsAccepted || !legacyChecked || rolesError || ownerCheckPending || ownerCheckError}
                  onClick={() => void confirmLegacy()}
                  className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {busy ? "Associando cadastro anterior…" : "Confirmo meus dados — recuperar conta e perfis"}
                </button>
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
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </section>
    </PageShell>
  );
}
