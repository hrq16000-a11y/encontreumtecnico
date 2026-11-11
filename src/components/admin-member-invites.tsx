import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ShieldCheck, ClipboardCopy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type InvitedRole = "tecnico" | "cliente";
type InviteRow = {
  id: string; target_role: InvitedRole; masked_email: string;
  status: string; created_at: string; expires_at: string;
};
const db = supabase as unknown as SupabaseClient;
const LOGIN_URL = "https://www.encontreumtecnico.com.br/entrar";
const LABELS: Record<InvitedRole, string> = { tecnico: "técnico", cliente: "cliente" };

/** Admin-only screen. Identity, restrictions and audit are enforced by RPC. */
export function AdminMemberInvites({ initialRole = "tecnico" }: { initialRole?: InvitedRole }) {
  const [role, setRole] = useState<InvitedRole>(initialRole);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [createdRole, setCreatedRole] = useState<InvitedRole>("tecnico");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void db.rpc("eut_admin_member_invites_snapshot").then(({ data, error: loadError }) => {
      if (!active) return;
      setRows(!loadError && Array.isArray(data?.invites) ? data.invites : []);
      if (loadError) setError("Não foi possível carregar os convites. Verifique seu acesso administrativo.");
    }).catch(() => {
      if (active) setError("Erro de conexão ao consultar os convites.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [version]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = email.trim().toLowerCase();
    const justification = reason.trim();
    if (justification.length < 8 || justification.length > 400) {
      setError("Informe um motivo administrativo de 8 a 400 caracteres.");
      return;
    }
    if (!window.confirm(
      "Criar convite para " + LABELS[role] + " destinado a " + normalizedEmail +
      "? Nenhum usuário será criado e nenhum e-mail será enviado automaticamente."
    )) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    setCreatedEmail(null);
    try {
      const { data, error: requestError } = await db.rpc("eut_admin_member_invite_action", {
        _action: "create", _email: normalizedEmail, _role: role,
        _invite_id: null, _reason: justification,
      });
      if (requestError || data?.ok !== true || data?.action !== "create" ||
          data?.target_role !== role) throw new Error("Convite não confirmado");
      setCreatedEmail(normalizedEmail);
      setCreatedRole(role);
      setNotice("Convite registrado e auditado. Copie a mensagem para encaminhar; nenhum e-mail foi enviado pelo portal.");
      setCopied(false);
      setEmail("");
      setReason("");
      setVersion((v) => v + 1);
    } catch {
      setError("Não foi possível registrar o convite. Verifique e-mail, restrições ou limite diário.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (busy || !window.confirm("Revogar este convite pendente? A operação será auditada.")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: requestError } = await db.rpc("eut_admin_member_invite_action", {
        _action: "revoke", _email: null, _role: null, _invite_id: id,
        _reason: "Convite revogado por decisão administrativa",
      });
      if (requestError || data?.ok !== true || data?.action !== "revoke") throw new Error("Falha ao revogar");
      setNotice("Convite revogado e registrado na auditoria.");
      setVersion((v) => v + 1);
    } catch {
      setError("Não foi possível revogar. Atualize a lista e tente novamente.");
    } finally { setBusy(false); }
  }

  const message = createdEmail
    ? "Você foi convidado(a) para se cadastrar como " + LABELS[createdRole] +
      " no Encontre um Técnico.\nAcesse " + LOGIN_URL +
      " e entre ou crie sua conta com o e-mail " + createdEmail +
      ".\nConfirme seu e-mail, aceite os termos e escolha Aceitar convite na tela de entrada." +
      " O convite vence em 72 horas e não garante atendimento ou certificação."
    : "";

  async function copyInvitation() {
    if (!createdEmail) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setNotice("Não foi possível copiar automaticamente. Selecione o texto abaixo para copiar.");
    }
  }

  return (
    <section aria-label="Criar contas por convite administrativo"
      className="mt-5 space-y-4 rounded-2xl border border-primary/20 bg-card p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          Convidar novo técnico ou cliente
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          O convite dura 72 horas e só pode ser aceito pelo próprio e-mail confirmado.
          Nenhuma senha, conta Google ou perfil público será criado pelo administrador.
          Cadastros WordPress devem seguir recuperação de titularidade.
        </p>
      </div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
        <label className="grid gap-1 text-sm font-semibold text-foreground">
          E-mail do destinatário
          <input required type="email" autoComplete="off" value={email} maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-base" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-foreground">
          Tipo de conta
          <select value={role} onChange={(event) => setRole(event.target.value as InvitedRole)}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
            <option value="tecnico">Técnico / prestador</option>
            <option value="cliente">Cliente</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-foreground sm:col-span-2">
          Motivo administrativo (auditado)
          <textarea required value={reason} minLength={8} maxLength={400} rows={2}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: convite para cadastro voluntário de novo profissional"
            className="rounded-lg border border-input bg-background px-3 py-2 text-base" />
        </label>
        <button type="submit" disabled={busy}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">
          {busy ? "Registrando convite…" : "Criar convite auditado"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/20 p-3 text-sm text-foreground">{notice}</p>}
      {createdEmail && <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-bold">Mensagem para o destinatário</p>
        <textarea readOnly rows={5} value={message} aria-label="Mensagem de convite para copiar"
          className="w-full rounded-lg border border-input bg-background p-3 text-sm" />
        <button type="button" onClick={() => void copyInvitation()}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary px-3 text-sm font-semibold text-primary">
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          {copied ? "Copiado" : "Copiar mensagem"}
        </button>
      </div>}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-foreground">Últimos convites</h3>
        <button type="button" onClick={() => setVersion((v) => v + 1)}
          className="min-h-10 rounded-lg border border-input px-3 text-sm">Atualizar</button>
      </div>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Consultando convites…</p> :
        rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum convite nesta consulta.</p> :
          <ul className="grid gap-2">
            {rows.map((entry) => <li key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="text-sm">
                <p className="font-semibold text-foreground">{entry.masked_email}</p>
                <p className="text-muted-foreground">{LABELS[entry.target_role]} · {entry.status === "pending"
                  ? "Pendente" : entry.status === "accepted" ? "Aceito" :
                    entry.status === "expired" ? "Expirado" : "Revogado"}</p>
              </div>
              {entry.status === "pending" && <button type="button" disabled={busy}
                onClick={() => void revoke(entry.id)}
                className="inline-flex min-h-10 items-center rounded-lg border border-input px-3 text-sm">
                Revogar
              </button>}
            </li>)}
          </ul>}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Limite de 20 convites por administrador a cada 24 horas, sem envio automático.
        Não revela contatos privados nem altera cadastros antigos.
      </p>
    </section>
  );
}
