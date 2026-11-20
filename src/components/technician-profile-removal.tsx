import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearProtectedDraft } from "@/lib/protected-session-draft";
import { technicianProfileWasRemoved } from "@/lib/technician-profile-removal-verification";

const db = supabase as unknown as SupabaseClient;

/** Remove somente a ficha pública do titular, nunca a conta Auth ou históricos. */
export function TechnicianProfileRemoval({
  userId,
  profileId,
  onRemoved,
}: {
  userId: string;
  profileId: string;
  onRemoved: () => void;
}) {
  const ownerRef = useRef(userId);
  ownerRef.current = userId;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    if (
      busy ||
      !window.confirm(
        "Excluir sua ficha técnica pública, apresentação, foto e telefone privado? " +
          "A conta de acesso e os registros obrigatórios de auditoria serão preservados. " +
          "Para anunciar novamente, será necessário preencher o perfil.",
      )
    )
      return;
    const owner = userId;
    setBusy(true);
    setMessage(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (ownerRef.current !== owner) return;
      if (authError || auth.user?.id !== owner) {
        setMessage("Sua sessão mudou. Entre novamente para excluir sua ficha.");
        return;
      }
      const { data, error } = await db.rpc("eut_remove_my_technician_profile");
      if (ownerRef.current !== owner) return;
      if (error || data?.state !== "removido" || data?.technician_id !== profileId) {
        setMessage("Não foi possível excluir a ficha. Nenhum dado de outra conta foi alterado.");
        return;
      }
      const { data: persisted, error: readError } = await supabase
        .from("technicians")
        .select("id,status,display_name,city,bio,specialties,service_slugs,avatar_path")
        .eq("user_id", owner)
        .maybeSingle();
      if (ownerRef.current !== owner) return;
      if (readError || !technicianProfileWasRemoved(profileId, persisted)) {
        setMessage(
          "O servidor respondeu, mas a exclusão não pôde ser conferida. Atualize o painel.",
        );
        return;
      }
      clearProtectedDraft("tecnico", owner);
      onRemoved();
    } catch {
      if (ownerRef.current === owner)
        setMessage("Falha de conexão. Recarregue o painel antes de tentar novamente.");
    } finally {
      if (ownerRef.current === owner) setBusy(false);
    }
  }

  return (
    <section
      aria-label="Excluir minha ficha técnica"
      className="mt-5 rounded-xl border border-destructive/30 p-4"
    >
      <h3 className="font-semibold text-foreground">Excluir minha ficha técnica</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Retira o perfil da busca pública, remove seus dados profissionais e o telefone privado, e
        desvincula a foto. Sua conta de login e os históricos obrigatórios permanecem protegidos.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="mt-3 min-h-11 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive disabled:opacity-60"
      >
        {busy ? "Excluindo…" : "Excluir minha ficha pública"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm text-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
