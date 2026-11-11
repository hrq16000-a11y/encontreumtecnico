import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Invitation = {
  pending: boolean;
  target_role?: "tecnico" | "cliente";
  expires_at?: string;
};
const db = supabase as unknown as SupabaseClient;

export function MemberInviteAcceptance({
  userId, termsAccepted, refreshRoles,
}: { userId: string; termsAccepted: boolean; refreshRoles: () => Promise<void> }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setInvitation(null);
    void db.rpc("eut_my_member_invitation").then(({ data, error: queryError }) => {
      if (!active) return;
      if (!queryError && data?.pending && (data.target_role === "tecnico" || data.target_role === "cliente")) {
        setInvitation(data as Invitation);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [userId]);

  if (!invitation) return null;

  async function accept() {
    if (busy || !termsAccepted || !invitation) return;
    if (!window.confirm("Aceitar convite para usar esta conta como " +
        (invitation.target_role === "tecnico" ? "técnico" : "cliente") +
        "? A conta do Google/e-mail continuará sendo sua e não será criada outra identidade."
    )) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: actionError } = await db.rpc("eut_accept_member_invitation");
      if (actionError || data?.ok !== true || data?.state !== "accepted" ||
          data?.target_role !== invitation.target_role) {
        throw new Error("O convite não foi confirmado.");
      }
      // The sign-in route already observes refreshed roles and goes to the
      // corresponding panel. It never trusts role data from a browser input.
      await refreshRoles();
      setInvitation(null);
    } catch {
      setError("Não foi possível aceitar. Confira o e-mail confirmado, a validade e as restrições da conta.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Convite de cadastro para o seu e-mail" className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
        Convite encontrado para seu e-mail confirmado
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Um administrador convidou esta conta para cadastro como
        <strong> {invitation.target_role === "tecnico" ? "técnico/prestador" : "cliente"}</strong>.
        Apenas o titular autenticado pode aceitar. Seu perfil técnico não será publicado automaticamente.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Validade: {invitation.expires_at ? new Date(invitation.expires_at).toLocaleString("pt-BR") : "consulte o suporte"}
      </p>
      <button type="button" disabled={busy || !termsAccepted} onClick={() => void accept()}
        className="mt-3 min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? "Confirmando convite…" : "Aceitar convite e abrir minha área"}
      </button>
      {!termsAccepted && <p className="mt-2 text-xs text-muted-foreground">Leia e aceite os termos acima antes de continuar.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
