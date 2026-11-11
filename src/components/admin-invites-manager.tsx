import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, Copy, MailPlus, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Invite = {
  id: string; email_normalized: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string; expires_at: string; accepted_at: string | null;
  revoked_at: string | null;
};
const db = supabase as unknown as SupabaseClient;

/** Admin role alone cannot use these RPCs: verified project owner only. */
export function AdminInvitesManager() {
  const [owner, setOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [items, setItems] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void db.rpc("eut_owner_admin_invites_snapshot").then(({ data, error: e }) => {
      if (!active) return;
      setOwner(!e && !!data && Array.isArray(data.invites));
      setItems(!e && Array.isArray(data?.invites) ? data.invites as Invite[] : []);
    }).catch(() => { if (active) { setOwner(false); setItems([]); } });
    return () => { active = false; };
  }, [version]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || busy || !window.confirm("Criar convite administrativo para o e-mail informado? A permissão só será concedida após aceite pela conta com e-mail verificado.")) return;
    setBusy(true); setFeedback(null); setError(null);
    const { data, error: e } = await db.rpc("eut_owner_admin_invite_action", {
      _action: "create", _target_email: email.trim().toLowerCase(),
      _invite_id: null, _reason: reason.trim(),
    });
    if (!e && data?.ok && data.action === "create" && data.id) {
      setEmail(""); setReason("");
      setFeedback("Convite criado e registrado. Compartilhe o link abaixo somente com o destinatário. Nenhum e-mail foi enviado automaticamente.");
      setVersion((v) => v + 1);
    } else setError(e?.message ?? "A criação do convite não foi confirmada.");
    setBusy(false);
  }

  async function revoke(id: string) {
    if (!owner || busy || revokeReason.trim().length < 8 ||
      !window.confirm("Revogar este convite pendente? O aceite deixará de ser possível.")) return;
    setBusy(true); setFeedback(null); setError(null);
    const { data, error: e } = await db.rpc("eut_owner_admin_invite_action", {
      _action: "revoke", _target_email: null, _invite_id: id,
      _reason: revokeReason.trim(),
    });
    if (!e && data?.ok && data.action === "revoke" && data.id === id) {
      setFeedback("Convite revogado e auditado."); setRevoking(null); setRevokeReason("");
      setVersion((v) => v + 1);
    } else setError(e?.message ?? "A revogação não foi confirmada.");
    setBusy(false);
  }
  if (!owner) return null;

  const invitationLink = typeof window === "undefined"
    ? "/convite-administrativo" : window.location.origin + "/convite-administrativo";

  return <section aria-label="Convites da administração" className="mt-8 space-y-4 rounded-2xl border border-primary/20 bg-card p-5">
    <div className="flex items-center gap-2">
      <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
      <h2 className="text-xl font-bold text-foreground">Convites administrativos do proprietário</h2>
    </div>
    <p className="text-sm text-muted-foreground">
      Somente o proprietário com Google verificado pode gerar ou revogar convites.
      O destinatário precisa autenticar o mesmo e-mail verificado e aceitar em até 48 horas.
      A criação não concede acesso automaticamente.
    </p>
    <form onSubmit={(e) => void create(e)} className="grid gap-3">
      <label className="text-sm font-semibold text-foreground">
        E-mail do destinatário
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          maxLength={254} autoComplete="off" className="mt-1 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-foreground" />
      </label>
      <label className="text-sm font-semibold text-foreground">
        Justificativa administrativa
        <textarea required minLength={8} maxLength={400} rows={2} value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-foreground" />
      </label>
      <button type="submit" disabled={busy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
        <MailPlus className="h-4 w-4" aria-hidden="true" /> {busy ? "Registrando..." : "Criar convite seguro"}
      </button>
    </form>
    {feedback && <p role="status" className="text-sm text-foreground">{feedback}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <span className="min-w-0 flex-1 break-all text-xs text-muted-foreground">{invitationLink}</span>
      <button type="button" onClick={() => {
        void navigator.clipboard?.writeText(invitationLink).then(
          () => setFeedback("Link copiado. O destinatário deve entrar com o e-mail convidado."),
          () => setError("Não foi possível copiar; selecione o endereço exibido."));
      }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3 text-sm text-foreground">
        <Copy className="h-4 w-4" aria-hidden="true" /> Copiar link
      </button>
    </div>
    <h3 className="font-semibold text-foreground">Últimos convites</h3>
    {items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum convite encontrado.</p> : (
      <ul className="space-y-2">
        {items.map((item) => {
          const canRevoke = item.status === "pending" && new Date(item.expires_at).getTime() > Date.now();
          return <li key={item.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 break-all font-semibold text-foreground">{item.email_normalized}</p>
              <span className="text-xs text-muted-foreground">{item.status === "pending" && !canRevoke ? "expirado" : item.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Criado: {new Date(item.created_at).toLocaleString("pt-BR")} · Vence: {new Date(item.expires_at).toLocaleString("pt-BR")}</p>
            {canRevoke && (revoking === item.id ?
              <div className="mt-2 flex flex-col gap-2">
                <input value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
                  minLength={8} maxLength={400} placeholder="Motivo para revogação (mínimo 8 caracteres)"
                  className="min-h-11 rounded-lg border border-input bg-background px-3 text-foreground" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || revokeReason.trim().length < 8}
                    onClick={() => void revoke(item.id)}
                    className="min-h-10 rounded-lg border border-destructive/40 px-3 text-destructive disabled:opacity-50">Confirmar revogação</button>
                  <button type="button" onClick={() => { setRevoking(null); setRevokeReason(""); }}
                    className="min-h-10 rounded-lg border px-3 text-foreground">Cancelar</button>
                </div>
              </div> :
              <button type="button" onClick={() => setRevoking(item.id)}
                className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-input px-3 text-foreground">
                <XCircle className="h-4 w-4" aria-hidden="true" /> Revogar
              </button>
            )}
          </li>;
        })}
      </ul>
    )}
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      Convites e aceites são auditados no banco. Não há geração de senhas ou envio de mensagens por este módulo.
    </p>
  </section>;
}
