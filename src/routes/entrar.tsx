import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "../components/page-placeholder";
import { signInWithGoogle, useAuth, type Role } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Encontre um Técnico" },
      { name: "description", content: "Acesse sua conta de técnico ou cliente com login Google." },
      { property: "og:title", content: "Entrar — Encontre um Técnico" },
      { property: "og:description", content: "Acesse sua conta de técnico ou cliente com login Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { user, roles, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
              Técnicos e clientes acessam com a conta Google.
            </p>
            <button
              type="button"
              onClick={google}
              className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              Entrar com Google
            </button>
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
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </section>
    </PageShell>
  );
}
