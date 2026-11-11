import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { googleIdentityHint } from "@/lib/google-identity-hint";
import { ShieldCheck, MailCheck, UserRound } from "lucide-react";

/** Private session display only. The photo is NOT published in technician cards. */
export function ConnectedGoogleIdentity({ user }: { user: User }) {
  const identity = googleIdentityHint(user);
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = (identity.fullName || identity.email || "?").trim().slice(0, 1).toLocaleUpperCase("pt-BR");
  return (
    <div className="mt-5 flex w-full items-center gap-4 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-card p-4 text-left shadow-sm"
      aria-label="Identidade da conta conectada">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 text-xl font-extrabold text-primary">
        {identity.avatarUrl && !photoFailed
          ? <img src={identity.avatarUrl} alt="" className="h-full w-full object-cover"
              loading="lazy" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} />
          : <span aria-hidden="true">{initial}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          {identity.googleConnected ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
          {identity.googleConnected ? "Google conectado" : "Conta conectada"}
        </p>
        <p className="mt-0.5 truncate font-bold text-card-foreground">{identity.fullName || "Complete seu nome no cadastro"}</p>
        <p className="mt-0.5 flex items-center gap-1.5 break-all text-xs text-muted-foreground">
          {identity.emailConfirmed && <MailCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {identity.email || "E-mail não disponível"}
        </p>
      </div>
    </div>
  );
}
