import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { authReturnUrl } from "@/lib/auth-domain";
import { readSignupIntent, rememberSignupIntent, type SignupIntent } from "@/lib/signup-intent";

type Mode = "entrar" | "cadastrar" | "recuperar";
type OpenAuth = (mode?: Mode, intent?: SignupIntent) => void;
const AuthContext = createContext<OpenAuth | null>(null);

/** The shell owns one accessible auth dialog; protected legacy/onboarding routes still work directly. */
export function useAuthDialog(): OpenAuth | null {
  return useContext(AuthContext);
}

const field = "min-h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary";

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("entrar");
  const [intent, setIntent] = useState<SignupIntent | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const openAuth: OpenAuth = (initialMode = "entrar", initialIntent) => {
    setMode(initialMode);
    setIntent(initialIntent ?? readSignupIntent());
    setError(null);
    setInfo(null);
    setOpen(true);
  };

  function chooseIntent(next: SignupIntent) {
    rememberSignupIntent(next);
    setIntent(next);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setInfo(null);
    const address = email.trim();
    if (!address) return setError("Informe seu e-mail.");
    if (mode === "cadastrar" && !termsAccepted) return setError("Aceite os Termos e a Política de Privacidade para criar uma conta.");
    if (mode !== "recuperar" && password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");

    setBusy(true);
    try {
      if (mode === "recuperar") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: authReturnUrl("/redefinir-senha", window.location.origin),
        });
        if (authError) setError("Não foi possível enviar a recuperação. Tente novamente.");
        else setInfo("Se este e-mail possuir uma conta, você receberá as instruções para redefinir a senha.");
      } else if (mode === "cadastrar") {
        if (intent) rememberSignupIntent(intent);
        const { data, error: authError } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: authReturnUrl("/entrar", window.location.origin) },
        });
        if (authError) setError("Não foi possível criar a conta. Se o e-mail já estiver cadastrado, utilize Entrar.");
        else if (!data.session) setInfo("Confira o seu e-mail para confirmar a conta. Seu cadastro antigo poderá ser reconhecido após o acesso.");
        else window.location.assign("/entrar");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
        if (authError) setError("Não foi possível entrar. Verifique os dados e a confirmação da conta.");
        else window.location.assign("/entrar"); // Mandatory legacy-claim and role reconciliation.
      }
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithGoogle() {
    if (busy) return;
    if (mode === "cadastrar" && !termsAccepted) {
      setError("Aceite os Termos e a Política de Privacidade antes de criar uma conta.");
      return;
    }
    if (mode === "cadastrar" && intent) rememberSignupIntent(intent);
    if (!sessionStorage.getItem("eut-after-login")) sessionStorage.setItem("eut-after-login", "/entrar");
    setError(null);
    setInfo(null);

    const callbackUrl = authReturnUrl("/entrar", window.location.origin);
    // OAuth storage is shared only on the same exact origin. Never attempt a
    // cross-origin opener bridge, or a popup inside the Lovable preview iframe.
    const sameOrigin = new URL(callbackUrl).origin === window.location.origin;
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const canPopup = sameOrigin && desktop && window.top === window;
    // Open synchronously in the click handler, before the async OAuth request.
    const popup = canPopup
      ? window.open("about:blank", "eut-google-login", "popup=yes,width=520,height=720,scrollbars=yes,resizable=yes")
      : null;
    if (popup) {
      // A reused named popup may already be on Google's origin.
      try {
        popup.document.title = "Entrar com Google — Encontre um Técnico";
        popup.document.body.innerHTML = '<p style="font:16px system-ui;padding:28px">Abrindo autenticação segura do Google…</p>';
      } catch { /* cross-origin popup: navigation still works */ }
      popup.focus();
    }
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
      });
      if (authError || !data.url) throw new Error("oauth-init");
      if (!popup) {
        // Mobile, popup blocker, iframe or different origin: use the existing
        // supported redirect flow with the same Supabase callback.
        window.location.assign(data.url);
        return;
      }
      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== popup) return;
        if (event.data?.type !== "eut:google-oauth-complete" &&
            event.data?.type !== "eut:google-oauth-error") return;
        window.removeEventListener("message", onMessage);
        if (event.data.type === "eut:google-oauth-error") {
          setBusy(false);
          setError("O acesso pelo Google não foi concluído. Você pode tentar novamente.");
          return;
        }
        // Never trust postMessage as authentication: verify with Supabase.
        const { data: session } = await supabase.auth.getUser();
        if (session.user) {
          window.location.assign("/entrar"); // Role/legacy account reconciliation.
        } else {
          setBusy(false);
          setError("Não foi possível confirmar a sessão. Tente novamente.");
        }
      };
      window.addEventListener("message", onMessage);
      popup.location.replace(data.url);
      // If the person closes Google's window, release the UI and allow a retry.
      const watch = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(watch);
        // Google may enforce COOP and report WindowProxy.closed early.
        // Keep the authenticated postMessage listener until it completes or times out.
        setBusy(false);
      }, 600);
      window.setTimeout(() => {
        window.clearInterval(watch);
        window.removeEventListener("message", onMessage);
        setBusy(false);
      }, 120000);
    } catch {
      popup?.close();
      setError("Não foi possível abrir o Google agora. Tente novamente ou use e-mail e senha.");
      setBusy(false);
    }
  }

  return (
    <AuthContext.Provider value={openAuth}>
      {children}
      <Dialog open={open} onOpenChange={(value) => { if (!busy || !value) setOpen(value); }}>
        <DialogContent className="max-h-[min(92dvh,790px)] w-[calc(100vw-24px)] max-w-[480px] overflow-y-auto rounded-3xl border-border bg-card p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-primary via-primary to-[oklch(0.30_0.10_245)] px-7 py-6 text-primary-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" /> Acesso protegido
            </span>
            <DialogHeader className="mt-4 text-left">
              <DialogTitle className="text-2xl font-extrabold text-white">
                {mode === "recuperar" ? "Recuperar acesso" : mode === "cadastrar" ? "Crie sua conta" : "Bem-vindo de volta"}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-white/85">
                {mode === "recuperar" ? "Enviaremos instruções ao seu e-mail." :
                  mode === "cadastrar" ? "Cadastro gratuito para técnicos e clientes." :
                  "Entre sem perder seus cadastros ou dados anteriores."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 pb-7 pt-1 sm:px-7">
            {mode === "cadastrar" && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Como você usará o portal?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={intent === "tecnico"} onClick={() => chooseIntent("tecnico")}
                    className={secondary + (intent === "tecnico" ? " border-primary bg-primary/10 text-primary" : "")}>
                    <Wrench className="mr-2 h-4 w-4" /> Sou técnico
                  </button>
                  <button type="button" aria-pressed={intent === "cliente"} onClick={() => chooseIntent("cliente")}
                    className={secondary + (intent === "cliente" ? " border-primary bg-primary/10 text-primary" : "")}>
                    <UserRound className="mr-2 h-4 w-4" /> Sou cliente
                  </button>
                </div>
              </div>
            )}
            {mode !== "recuperar" && (
              <button type="button" onClick={() => void loginWithGoogle()} disabled={busy}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-4 text-sm font-bold text-foreground shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
                <span aria-hidden="true" className="text-xl font-bold text-[#4285F4]">G</span>
                Continuar com Google <ArrowRight className="ml-auto h-4 w-4" />
              </button>
            )}
            {mode !== "recuperar" && <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou use seu e-mail <span className="h-px flex-1 bg-border" />
            </div>}
            <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
              <label className="block space-y-1.5 text-sm font-semibold text-foreground">
                E-mail
                <span className="relative block"><Mail className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                  <input className={field + " pl-11"} type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
                </span>
              </label>
              {mode !== "recuperar" && (
                <label className="block space-y-1.5 text-sm font-semibold text-foreground">
                  Senha
                  <span className="relative block">
                    <LockKeyhole className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                    <input className={field + " pl-11 pr-12"} type={showPassword ? "text" : "password"}
                      minLength={6} required autoComplete={mode === "cadastrar" ? "new-password" : "current-password"}
                      value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Pelo menos 6 caracteres" />
                    <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center text-muted-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>
              )}
              {mode === "cadastrar" && (
                <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <input type="checkbox" className="mt-1 accent-primary" checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)} />
                  <span>Aceito os <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Política de Privacidade</a>.</span>
                </label>
              )}
              {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
              {info && <p role="status" className="flex gap-2 rounded-lg bg-primary/10 p-3 text-xs text-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />{info}</p>}
              <button type="submit" disabled={busy || (mode === "cadastrar" && !termsAccepted)}
                className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">
                {busy ? "Aguarde…" : mode === "recuperar" ? "Enviar instruções" : mode === "cadastrar" ? "Criar conta" : "Entrar na minha conta"}
              </button>
            </form>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
              {mode !== "recuperar" && <button type="button" className="font-semibold text-primary hover:underline"
                onClick={() => switchMode(mode === "entrar" ? "cadastrar" : "entrar")}>
                {mode === "entrar" ? "Criar conta gratuita" : "Já tenho uma conta"}
              </button>}
              <button type="button" className="font-semibold text-primary hover:underline"
                onClick={() => switchMode(mode === "recuperar" ? "entrar" : "recuperar")}>
                {mode === "recuperar" ? "Voltar para entrar" : "Esqueci minha senha"}
              </button>
            </div>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Sua identidade e permissões são verificadas pelo servidor. Cadastros anteriores podem ser recuperados após o login.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}
