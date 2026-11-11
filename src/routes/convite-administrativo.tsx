import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/convite-administrativo")({
  head: () => ({ meta: [
    { name: "robots", content: "noindex, nofollow" },
    { title: "Convite administrativo — Encontre um Técnico" },
  ] }),
  component: AdminInvitationPage,
});

type PendingInvite = { id?: string; pending?: boolean; expires_at?: string };
const db = supabase as unknown as SupabaseClient;

export function AdminInvitationPage() {
  const { user, loading, roles, refreshRoles } = useAuth();
  const [pending, setPending] = useState<PendingInvite | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAccepted(false);
    setPending(null);
    setMessage(null);
    if (!user?.id) return;
    setChecking(true);
    void Promise.resolve(db.rpc("eut_my_admin_invitation")).then(({ data, error }) => {
      if (!active) return;
      setPending(error ? null : (data as PendingInvite));
      setMessage(error ? "Não foi possível conferir o convite. Consulte o suporte." : null);
    }).catch(() => { if (active) setMessage("Falha de conexão ao conferir convite."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [user?.id]);

  async function accept() {
    if (!user || !pending?.id || busy ||
      !window.confirm("Aceitar o convite e ativar permissão administrativa para esta conta?")) return;
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await db.rpc("eut_accept_admin_invitation", { _invite_id: pending.id });
      if (error || !data?.ok || !data?.accepted) {
        setMessage("Não foi possível aceitar o convite. Verifique o prazo e o e-mail, ou consulte o suporte.");
      } else {
        setAccepted(true);
        setPending(null);
        await refreshRoles();
      }
    } catch {
      setMessage("Não foi possível confirmar o aceite. Tente novamente.");
    } finally { setBusy(false); }
  }

  return <PageShell>
    <section className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-foreground">Convite administrativo</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        O acesso só é concedido após confirmar sua identidade por Google ou e-mail verificado
        e aceitar um convite válido emitido pelo proprietário.
      </p>
      {loading ? <p className="mt-6 text-sm text-muted-foreground">Conferindo sessão…</p> :
      !user ? <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-foreground">Entre com o mesmo e-mail para o qual o convite foi emitido.</p>
        <Link to="/entrar" onClick={() => {
          try { sessionStorage.setItem("eut-after-login", "/convite-administrativo"); } catch { /* private mode */ }
        }} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-bold text-primary-foreground">
          Entrar ou criar conta</Link>
      </div> :
      accepted || roles.includes("admin") ?
        <div className="mt-6 space-y-4 rounded-2xl border border-primary/30 bg-card p-5">
          <p className="font-semibold text-foreground">Acesso administrativo confirmado para esta conta.</p>
          <Link to="/admin" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-bold text-primary-foreground">Abrir painel administrativo</Link>
        </div> :
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        {checking ? <p className="text-sm text-muted-foreground">Procurando convite válido…</p> :
        pending?.pending && pending.id ? <>
          <p className="font-semibold text-foreground">Você possui um convite pendente.</p>
          <p className="mt-2 text-sm text-muted-foreground">Expira em {pending.expires_at ? new Date(pending.expires_at).toLocaleString("pt-BR") : "48 horas"}.</p>
          <button type="button" disabled={busy} onClick={() => void accept()}
            className="mt-4 min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60">
            {busy ? "Validando…" : "Aceitar convite administrativo"}
          </button>
        </> : <p className="text-sm text-muted-foreground">
          Nenhum convite pendente para o e-mail verificado desta sessão. Confira a conta utilizada ou procure o suporte.
        </p>}
      </div>}
      {message && <p role="alert" className="mt-4 text-sm text-destructive">{message}</p>}
    </section>
  </PageShell>;
}
