import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { containsObviousContact } from "@/lib/private-message-validation";
import { accountScopedRows, canAcceptAccountResult } from "@/lib/account-scoped-queries";
import type { SupabaseClient } from "@supabase/supabase-js";

const replyDb = supabase as unknown as SupabaseClient;

type DirectReply = { request_id: string; body: string; created_at: string };

type DirectRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  region: string | null;
  created_at: string;
};

export function TechnicianDirectRequests({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<DirectRequest[]>([]);
  const [requestsOwnerId, setRequestsOwnerId] = useState<string | null>(null);
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;
  const loadVersion = useRef(0);
  const ownRequests = accountScopedRows(requests, requestsOwnerId, userId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [replies, setReplies] = useState<Record<string, DirectReply>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const owner = userId;
    const version = ++loadVersion.current;
    const current = () => canAcceptAccountResult(owner, currentUserIdRef.current, version, loadVersion.current);
    setLoading(true);
    setError(false);
    setRequestsOwnerId(null);
    setRequests([]);
    setReplies({});

    try {
      const profile = await supabase.from("technicians")
        .select("id,status").eq("user_id", owner).maybeSingle();
      if (!current()) return;
      if (profile.error) throw profile.error;
      if (!profile.data || profile.data.status !== "aprovado") {
        setRequests([]);
        setRequestsOwnerId(owner);
        return;
      }
      // Server-side RLS exposes only requests with the client's explicit
      // consent for this exact approved technician profile.
      const result = await supabase.from("service_requests")
        .select("id,title,description,category,city,region,created_at")
        .eq("technician_id", profile.data.id)
        .order("created_at", { ascending: false }).limit(30);
      if (!current()) return;
      if (result.error) throw result.error;
      const rows = result.data ?? [];
      if (!rows.length) {
        setRequests([]);
        setRequestsOwnerId(owner);
        return;
      }
      const response = await replyDb.from("eut_direct_request_replies")
        .select("request_id,body,created_at")
        .in("request_id", rows.map((entry) => entry.id));
      if (!current()) return;
      if (response.error) throw response.error;
      setRequests(rows);
      setReplies(Object.fromEntries(((response.data ?? []) as DirectReply[])
        .map((entry) => [entry.request_id, entry])));
      setRequestsOwnerId(owner);
    } catch {
      if (!current()) return;
      setError(true);
      setRequests([]);
      setReplies({});
      setRequestsOwnerId(owner);
    } finally {
      if (current()) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setNotice(null);
    setDrafts({});
    void refresh();
    return () => { loadVersion.current++; };
  }, [refresh]);

  async function submitReply(requestId: string) {
    if (sendingId) return;
    if (!ownRequests?.some((request) => request.id === requestId)) {
      setNotice("Pedido indisponível nesta sessão. Atualize para consultar novamente.");
      return;
    }
    const owner = userId;
    const body = (drafts[requestId] ?? "").trim();
    if (body.length < 20 || body.length > 700) {
      setNotice("A resposta precisa ter de 20 a 700 caracteres.");
      return;
    }
    if (containsObviousContact(body)) {
      setNotice("Remova números de telefone, e-mails, links e endereços completos da resposta.");
      return;
    }
    setNotice(null);
    setSendingId(requestId);
    try {
      const { data, error } = await replyDb.rpc("eut_respond_to_direct_request", {
        _request_id: requestId, _body: body,
      });
      if (currentUserIdRef.current !== owner) return;
      if (error) {
        setNotice("Não foi possível responder. Verifique se o pedido continua ativo e remova dados pessoais do texto.");
      } else if (data?.status === "respondido" || data?.status === "ja_respondido") {
        setNotice("Resposta registrada. O cliente poderá consultá-la no painel ao atualizar os pedidos.");
        setDrafts((current) => ({ ...current, [requestId]: "" }));
        await refresh();
      } else {
        setNotice("Não conseguimos confirmar o registro da resposta. Atualize o painel.");
      }
    } catch {
      if (currentUserIdRef.current === owner) setNotice("Falha de conexão. Nenhuma confirmação de envio foi recebida.");
    } finally {
      if (currentUserIdRef.current === owner) setSendingId(null);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border p-5" aria-labelledby="direct-requests-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="direct-requests-title" className="text-lg font-semibold text-foreground">
          Pedidos enviados diretamente a você
        </h2>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="min-h-10 rounded-md border border-input px-3 py-2 text-sm text-foreground disabled:opacity-60">
          Atualizar pedidos
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Apenas solicitações compartilhadas voluntariamente pelo cliente para este perfil.
        Responda por texto uma única vez, sem números, e-mails, links ou endereço completo.
        Não há distribuição automática, contratação, reserva ou liberação de contatos.
      </p>
      {notice && <p role="status" className="mt-3 text-sm text-foreground">{notice}</p>}
      {loading || ownRequests === null ? <p role="status" className="mt-4 text-sm text-muted-foreground">Carregando pedidos…</p>
        : error ? <p role="alert" className="mt-4 text-sm text-destructive">Não foi possível consultar os pedidos. Tente atualizar.</p>
        : ownRequests.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhum pedido enviado diretamente a você.</p>
        : (
          <ul className="mt-4 grid gap-3">
            {ownRequests.map((request) => (
              <li key={request.id} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-card-foreground">{request.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {request.category} · {request.city}{request.region ? ` · ${request.region}` : ""}
                  {" · "}{new Date(request.created_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="mt-3 whitespace-pre-line break-words text-sm text-foreground">{request.description}</p>
                {replies[request.id] ? (
                  <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary">Sua resposta foi registrada</p>
                    <p className="mt-2 whitespace-pre-line break-words text-sm text-foreground">{replies[request.id]!.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(replies[request.id]!.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={(event) => { event.preventDefault(); void submitReply(request.id); }}
                    className="mt-4 space-y-2">
                    <label className="block text-sm font-medium text-foreground" htmlFor={`reply-${request.id}`}>
                      Responder ao cliente pelo painel
                    </label>
                    <textarea id={`reply-${request.id}`} required minLength={20} maxLength={700} rows={3}
                      value={drafts[request.id] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                      placeholder="Ex.: Posso analisar esse problema. Confira o serviço e a região para combinarmos os próximos passos."
                      className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground" />
                    <button type="submit" disabled={sendingId !== null}
                      className="min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                      {sendingId === request.id ? "Registrando resposta…" : "Enviar resposta privada"}
                    </button>
                  </form>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  O contato privado do cliente não está disponível nesta mensagem.
                  Não compartilhe dados pessoais de terceiros.
                </p>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
