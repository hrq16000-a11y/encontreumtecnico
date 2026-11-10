import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilianPhone } from "@/lib/brazilian-phone";

const db = supabase as unknown as SupabaseClient;

type OwnContact = {
  has_number: boolean;
  phone: string | null;
  allow_paid_contact: boolean;
};

function isOwnContact(v: unknown): v is OwnContact {
  if (!v || typeof v !== "object") return false;
  const row = v as Partial<OwnContact>;
  return typeof row.has_number === "boolean"
    && (row.phone === null || typeof row.phone === "string")
    && typeof row.allow_paid_contact === "boolean";
}

/** Phone is requested ONLY via a technician-owned authenticated RPC.
 * Never put phone in SSR, public technician records, metadata or URL parameters.
 */
export function TechnicianPrivateContact({ userId }: { userId: string }) {
  const [phone, setPhone] = useState("");
  const [allowPaidContact, setAllowPaidContact] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage(null);
    setPhone("");
    setHasNumber(false);
    setAllowPaidContact(false);
    void Promise.resolve(db.rpc("eut_my_private_contact")).then(({ data, error }) => {
      if (!active) return;
      if (error || !isOwnContact(data)) {
        setMessage("Não foi possível consultar seu contato privado. Tente recarregar o painel.");
      } else {
        setPhone(data.phone ?? "");
        setHasNumber(data.has_number);
        setAllowPaidContact(data.allow_paid_contact);
      }
      setLoading(false);
    }).catch(() => {
      if (active) {
        setMessage("A consulta do número privado está indisponível.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || loading) return;
    const normalizedPhone = normalizeBrazilianPhone(phone);
    if (!normalizedPhone) {
      setMessage("Informe um telefone com DDD: 10 dígitos (fixo) ou 11 dígitos (celular).");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await db.rpc("eut_save_my_private_contact", {
        _phone: normalizedPhone,
        _allow_paid_contact: allowPaidContact,
      });
      if (error || data?.saved !== true) {
        setMessage("Não foi possível salvar o número. Confira o DDD e tente novamente.");
      } else {
        setHasNumber(true);
        setMessage(allowPaidContact
          ? "Telefone salvo de forma privada. A liberação exige acesso confirmado, quando disponível."
          : "Telefone salvo como privado. Você ainda não autorizou a liberação após compra.");
      }
    } catch {
      setMessage("Falha de conexão ao salvar o contato privado.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!hasNumber || busy || !window.confirm("Excluir seu telefone do portal? Compras anteriores também ficarão sem acesso ao número enquanto ele estiver ausente.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await db.rpc("eut_remove_my_private_contact");
      if (error || data !== true) {
        setMessage("Não foi possível excluir o número. Tente novamente.");
      } else {
        setPhone("");
        setHasNumber(false);
        setAllowPaidContact(false);
        setMessage("Seu número foi excluído do cadastro de contatos do portal.");
      }
    } catch {
      setMessage("Falha de conexão ao excluir o contato privado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5" aria-label="Meu telefone privado">
      <h2 className="text-lg font-semibold text-card-foreground">Meu telefone privado</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cadastre um telefone fixo (10 dígitos) ou celular (11 dígitos), sempre com DDD. Um telefone fixo não garante WhatsApp. Ele não aparece no seu perfil público,
        no Google nem na busca de técnicos. A liberação a clientes depende de uma aquisição confirmada,
        quando o sistema de pagamento estiver disponível.
      </p>
      <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-4">
        <label className="text-sm font-medium text-foreground">
          Telefone com DDD (fixo ou celular)
          <input type="tel" inputMode="tel" autoComplete="tel-national" required
            maxLength={40} disabled={busy || loading}
            placeholder="Ex.: (41) 3333-4444 ou (41) 99999-8888"
            value={phone} onChange={(event) => setPhone(event.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground disabled:opacity-60" />
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <input type="checkbox" checked={allowPaidContact}
            disabled={busy || loading}
            onChange={(event) => setAllowPaidContact(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0" />
          <span>Autorizo que meu número seja fornecido <strong>somente a clientes com acesso pago confirmado</strong>,
            conforme as condições do portal. Posso desativar esta autorização quando quiser.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || loading}
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Atualizando…" : hasNumber ? "Atualizar telefone privado" : "Salvar telefone privado"}
          </button>
          {hasNumber && (
            <button type="button" onClick={() => void remove()} disabled={busy || loading}
              className="min-h-11 rounded-md border border-input px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60">
              Excluir meu número
            </button>
          )}
        </div>
        {message && <p role="status" className="text-sm text-foreground">{message}</p>}
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        Cadastrar o telefone não gera cobrança ou mensalidade para o prestador. Não significa que o
        pagamento do cliente já esteja ativado ou que o portal tenha verificado a profissão informada.
      </p>
    </section>
  );
}
