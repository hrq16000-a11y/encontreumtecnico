import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShieldCheck, Wrench, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

/**
 * Explicit self-service for an already verified admin. The RPC determines
 * identity via auth.uid(), rechecks the role, and writes a private audit entry.
 * It never adds an admin role, signs up another person or publishes a profile.
 */
export function AdminOwnTechnicianRole({
  isTechnician, refreshRoles,
}: { isTechnician: boolean; refreshRoles: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = isTechnician || confirmed;

  async function activate() {
    if (busy || enabled) return;
    if (!window.confirm(
      "Adicionar o papel de técnico à SUA conta atual? O acesso administrativo será preservado. " +
      "Seu perfil profissional só será público após o preenchimento e a publicação no painel técnico."
    )) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await db.rpc("eut_admin_enable_my_technician_role");
      if (rpcError || !data ||
        !["activated", "already_active"].includes(data.state) ||
        data.admin_preserved !== true ||
        data.technician_enabled !== true) {
        throw new Error("A ativação não foi confirmada no servidor.");
      }
      await refreshRoles();
      setConfirmed(true);
    } catch {
      setError("Não foi possível habilitar seu papel de técnico. Verifique a sessão ou consulte o suporte.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Meu perfil técnico com acesso administrativo"
      className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
            Minha conta · Administração e perfil técnico
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {enabled
              ? "Seu acesso administrativo permanece independente do perfil técnico. Abra a área profissional para completar ou atualizar suas informações."
              : "Use a mesma conta para administrar o portal e também se cadastrar como técnico, sem criar outro login nem trocar suas permissões administrativas."}
          </p>
        </div>
        {enabled
          ? <Link to="/area-tecnico" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
              <Wrench className="h-4 w-4" aria-hidden="true" /> Abrir minha área técnica
            </Link>
          : <button type="button" disabled={busy} onClick={() => void activate()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <Wrench className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Validando conta…" : "Ativar meu perfil técnico"}
            </button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Ativação sujeita à identidade verificada, às regras de bloqueio e à auditoria do banco.
        Nenhum contato privado é publicado nesta etapa.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
