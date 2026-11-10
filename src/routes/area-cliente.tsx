import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { RequestCard, type Req } from "../components/request-list";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";
import { CustomerLocationButton } from "@/components/customer-location-button";
import { consumeTriageDraft } from "@/lib/triage-draft";
import { clearTechnicianTarget, recallTechnicianTarget, rememberTechnicianTarget } from "@/lib/selected-technician-target";
import { containsObviousContact } from "@/lib/private-message-validation";
import { accountScopedRows, canAcceptAccountResult } from "@/lib/account-scoped-queries";
import { persistClientRequest } from "@/lib/client-request-save";
import { ownedRequestForAction } from "@/lib/client-request-action";

export const Route = createFileRoute("/area-cliente")({
  validateSearch: zodValidator(z.object({ tecnico: z.string().optional() })),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Área do cliente — Encontre um Técnico" },
      { name: "description", content: "Abra solicitações de atendimento e acompanhe o histórico e o status de cada uma." },
      { property: "og:title", content: "Área do cliente — Encontre um Técnico" },
      { property: "og:description", content: "Abra solicitações de atendimento e acompanhe o histórico e o status de cada uma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CanonicalClientAreaPage,
});

const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const directDb = supabase as unknown as SupabaseClient;

type DirectReply = { request_id: string; body: string; created_at: string };

function CanonicalClientAreaPage() {
  const { tecnico } = Route.useSearch();
  return <ClientAreaPage tecnico={tecnico} />;
}

export function ClientAreaPage({ tecnico }: { tecnico?: string | undefined }) {
  const lp2 = useContext(LP2EmbeddedContext);
  const { user, loading, roles } = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [rowsOwnerId, setRowsOwnerId] = useState<string | null>(null);
  const [rowsError, setRowsError] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = user?.id ?? null;
  const loadVersion = useRef(0);
  const ownRows = accountScopedRows(rows, rowsOwnerId, roles.includes("cliente") ? user?.id : null);
  const { categories, loading: catalogLoading, error: catalogError } = useActiveCategories();
  const [form, setForm] = useState({ title: "", description: "", category: "", city: "", region: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingSubmission = useRef<{ fingerprint: string; id: string } | null>(null);
  const [shareNow, setShareNow] = useState(false);
  const [technicianTarget, setTechnicianTarget] = useState<string | null>(tecnico ?? null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [replyByRequest, setReplyByRequest] = useState<Record<string, DirectReply>>({});
  const [replyLoadError, setReplyLoadError] = useState(false);

  useEffect(() => {
    // Never reuse a previous account's unsent form, confirmation or request ID.
    // Does not erase the same-tab triage draft, which is recovered below
    // only after a verified client role has loaded.
    setForm({ title: "", description: "", category: "", city: "", region: "" });
    setMsg(null);
    setSaving(false);
    // A pending share belongs to the previous account. Its finally handler
    // intentionally cannot mutate another user's state, so clear it here.
    setSendingId(null);
    setShareNow(false);
    pendingSubmission.current = null;
  }, [user?.id]);

  useEffect(() => {
    // Keep the selected public UUID across a Google/email login redirect.
    // Only this ID is persisted and it expires automatically after 30 min.
    if (tecnico) {
      const valid = rememberTechnicianTarget(tecnico);
      setTechnicianTarget(valid ? tecnico : null);
    } else {
      setTechnicianTarget(recallTechnicianTarget());
    }
  }, [tecnico]);

  useEffect(() => {
    // Read only after a verified client session exists. Otherwise a login
    // redirect would consume the draft before the client can use it.
    if (loading || !user || !roles.includes("cliente")) return;
    const draft = consumeTriageDraft();
    if (!draft) return;
    setForm((current) => ({
      ...current,
      title: draft.description.slice(0, 120).trim(),
      description: draft.description,
      category: draft.category === "Todas" ? "" : draft.category,
      city: draft.city,
      region: draft.region,
    }));
    setMsg("Sua triagem foi recuperada. Revise a descrição, a categoria e a cidade antes de salvar.");
  }, [loading, user?.id, roles.join(",")]);

  async function load() {
    if (!user || !roles.includes("cliente")) return;
    const owner = user.id;
    const version = ++loadVersion.current;
    const current = () => canAcceptAccountResult(owner, currentUserIdRef.current, version, loadVersion.current);
    setRows(null);
    setRowsOwnerId(null);
    setRowsError(false);
    setReplyLoadError(false);
    setSharedIds(new Set());
    setReplyByRequest({});

    try {
      const { data, error } = await supabase.from("service_requests")
        .select("*").eq("client_id", owner).order("created_at", { ascending: false });
      if (!current()) return;
      if (error) throw error;

      const mine = data ?? [];
      setRows(mine);
      setRowsOwnerId(owner);
      if (!mine.length) return;

      const [shares, replies] = await Promise.all([
        directDb.from("eut_direct_request_consents").select("request_id").eq("client_id", owner),
        directDb.from("eut_direct_request_replies").select("request_id,body,created_at")
          .in("request_id", mine.map((item) => item.id)),
      ]);
      if (!current()) return;
      if (shares.error || replies.error) {
        setReplyLoadError(true);
      }
      if (!shares.error) {
        setSharedIds(new Set((shares.data ?? []).map((entry: { request_id: string }) => entry.request_id)));
      }
      if (!replies.error) {
        setReplyByRequest(Object.fromEntries(((replies.data ?? []) as DirectReply[])
          .map((entry) => [entry.request_id, entry])));
      }
    } catch {
      if (!current()) return;
      // Never turn a failed private query into "you have no requests".
      setRowsError(true);
      setRows(null);
      setRowsOwnerId(null);
      setSharedIds(new Set());
      setReplyByRequest({});
    }
  }
  useEffect(() => {
    void load();
    // Invalidate in-flight account-owned queries when the component unmounts.
    return () => { loadVersion.current++; };
  }, [user?.id, roles.join(",")]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || !roles.includes("cliente") || saving) return;
    if (catalogLoading || catalogError || !categories.some((entry) => entry.slug === form.category)) {
      return setMsg("Escolha uma categoria ativa antes de guardar sua solicitação.");
    }
    if (shareNow && technicianTarget &&
        containsObviousContact(`${form.title} ${form.description} ${form.city} ${form.region}`)) {
      return setMsg("Remova telefone, e-mail, links e endereço completo antes de compartilhar. Nenhum técnico recebeu seus dados.");
    }
    // Reuse the same UUID if a network timeout made the first attempt
    // inconclusive. Retrying must not silently create a duplicate request.
    const owner = user.id;
    const fingerprint = JSON.stringify([owner, technicianTarget,
      form.title.trim(), form.description.trim(), form.category, form.city.trim(), form.region.trim()]);
    const requestId = pendingSubmission.current?.fingerprint === fingerprint
      ? pendingSubmission.current.id : crypto.randomUUID();
    pendingSubmission.current = { fingerprint, id: requestId };
    const shouldShare = Boolean(shareNow && technicianTarget);

    setSaving(true);
    setMsg(null);
    try {
      const result = await persistClientRequest(
        async () => {
          const { error } = await supabase.from("service_requests").insert({
            id: requestId,
            client_id: owner,
            technician_id: technicianTarget ?? null,
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category,
            city: form.city.trim(),
            region: form.region.trim() || null,
          });
          return { error };
        },
        shouldShare ? async () => {
          const { data, error } = await directDb.rpc("eut_share_direct_request", {
            _request_id: requestId,
          });
          return { data, error };
        } : undefined,
      );
      if (currentUserIdRef.current !== owner) return;

      if (result === "save_rejected") {
        setMsg("O servidor não confirmou este pedido. Confira seu histórico antes de tentar novamente; nenhum compartilhamento foi confirmado.");
        void load();
        return;
      }
      if (result === "save_unconfirmed") {
        setMsg("A conexão caiu antes da confirmação. O pedido pode ter sido salvo: atualize o histórico antes de tentar novamente. Seu texto foi preservado.");
        void load();
        return;
      }

      // The row is now confirmed saved, even when the separate share RPC
      // failed or timed out. Never tell the customer the share was confirmed.
      if (result === "shared") {
        setMsg("Pedido compartilhado com o técnico escolhido. Ele poderá consultá-lo no painel. Nenhum telefone foi liberado.");
      } else if (result === "share_unconfirmed") {
        setMsg("O pedido foi salvo, mas o compartilhamento não foi confirmado. Confira o histórico antes de reenviar ao técnico escolhido.");
      } else {
        setMsg("Necessidade guardada somente na sua área privada. Nenhum técnico recebeu este registro.");
      }
      pendingSubmission.current = null;
      window.__lovableEvents?.track?.("project.service_requested", {
        category: form.category, direct_to_technician: shouldShare,
      });
      setShareNow(false);
      clearTechnicianTarget();
      setTechnicianTarget(null);
      setForm((current) => ({ ...current, title: "", description: "" }));
      void load();
    } catch {
      if (currentUserIdRef.current === owner) {
        setMsg("Não foi possível confirmar o salvamento. Confira seus pedidos antes de repetir; o formulário foi preservado.");
      }
    } finally {
      if (currentUserIdRef.current === owner) setSaving(false);
    }
  }

  async function shareExisting(id: string) {
    const owner = user?.id;
    if (sendingId || !owner || !roles.includes("cliente")) return;
    const request = ownedRequestForAction(ownRows, owner, id, "share");
    if (!request) {
      setMsg("Este pedido não está disponível nesta conta para compartilhamento.");
      return;
    }
    if (containsObviousContact(`${request.title} ${request.description} ${request.city} ${request.region ?? ""}`)) {
      setMsg("Antes de compartilhar, retire telefone, e-mail, links e endereço completo. O pedido permanece privado.");
      return;
    }
    setSendingId(id);
    setMsg(null);
    try {
      const { data, error } = await directDb.rpc("eut_share_direct_request", { _request_id: id });
      if (currentUserIdRef.current !== owner) return;
      setMsg(error || data?.status !== "enviado"
        ? "Não foi possível compartilhar. Confira o perfil escolhido ou tente novamente."
        : "Pedido enviado somente ao profissional selecionado. Contatos privados continuam protegidos.");
      if (!error) void load();
    } catch {
      if (currentUserIdRef.current === owner) {
        setMsg("Falha de conexão ao compartilhar o pedido.");
      }
    } finally {
      if (currentUserIdRef.current === owner) setSendingId(null);
    }
  }

  async function cancel(id: string) {
    const owner = user?.id;
    if (!owner || !roles.includes("cliente") ||
        !ownedRequestForAction(ownRows, owner, id, "cancel")) {
      setMsg("Não é possível cancelar este pedido nesta conta.");
      return;
    }
    try {
      const { error } = await supabase.rpc("set_request_status", { _id: id, _status: "cancelada" });
      if (currentUserIdRef.current !== owner) return;
      if (error) setMsg("Não foi possível cancelar. Atualize o histórico antes de tentar novamente.");
      else void load();
    } catch {
      if (currentUserIdRef.current === owner) {
        setMsg("Falha de conexão ao cancelar. Confira o histórico antes de repetir.");
      }
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Área do cliente</h1>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user || !roles.includes("cliente") ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link to={lp2 ? "/lp2/entrar" : "/entrar"} className="font-medium text-primary underline">Entre com uma conta de cliente</Link> para abrir e acompanhar suas solicitações.
          </p>
        ) : (
          <>
            <LegacyAccountActivation userId={user.id} role="cliente" />
            <h2 className="mt-6 text-lg font-semibold text-foreground">Registrar minha necessidade</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você pode guardar sua necessidade em particular ou compartilhar voluntariamente com o técnico escolhido.
              O compartilhamento envia apenas o texto, a categoria e a região informada; não constitui contratação,
              não libera telefone ou e-mail e não realiza cobrança. Evite colocar contato ou endereço completo na descrição.
            </p>
            {technicianTarget && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                Este profissional foi selecionado. Você pode guardar o pedido em particular ou
                autorizar que ele visualize a descrição na sua área de técnico. Nenhum telefone é liberado.
                {" "}<Link to="/acesso-contato/$tecnicoId" params={{ tecnicoId: technicianTarget }}
                  className="font-semibold text-primary underline">Consultar condições de acesso ao contato</Link>
              </div>
            )}
            <div className="mt-4">
              <CustomerLocationButton onLocated={(area, source) => {
                setForm(current => source === "automatic" && current.city.trim()
                  ? current : { ...current, city: area.city, region: area.neighborhood });
              }} />
            </div>
            <form onSubmit={submit} className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-foreground">Resumo do problema
                <input required minLength={5} maxLength={120} className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-foreground">Descrição
                <textarea required minLength={10} maxLength={2000} rows={4} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium text-foreground">Categoria
                  <select required className={input} value={form.category} disabled={catalogLoading || Boolean(catalogError)}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Selecione uma categoria</option>
                    {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                  </select>
                  {catalogError && <span role="alert" className="mt-1 block text-xs text-destructive">
                    Catálogo de serviços indisponível. Recarregue a página.
                  </span>}
                </label>
                <label className="text-sm font-medium text-foreground">Cidade
                  <input required maxLength={80} className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">Bairro / região
                  <input maxLength={120} className={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </label>
              </div>
              {technicianTarget && (
                <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm text-foreground">
                  <input type="checkbox" checked={shareNow} onChange={(e) => setShareNow(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0" />
                  <span>Autorizo compartilhar o título, a descrição, a categoria e a localidade informada
                    somente com o técnico selecionado. Não incluo telefone, e-mail ou endereço completo.
                    Sei que isso não é uma contratação nem libera contato privado.</span>
                </label>
              )}
              <button disabled={saving || catalogLoading || Boolean(catalogError) || categories.length === 0} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Salvando…" : shareNow && technicianTarget ? "Salvar e enviar ao técnico escolhido" : "Guardar necessidade na minha área"}
              </button>
              {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
            </form>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Meus pedidos e respostas</h2>
              <button type="button" onClick={() => void load()}
                className="min-h-10 rounded-md border border-input px-3 text-sm text-foreground">
                Atualizar respostas
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              A resposta do profissional aparece aqui depois que ele a registra.
              Esta área não libera números nem confirma contratação.
            </p>
            {replyLoadError && <p role="alert" className="mt-2 text-sm text-destructive">
              Não foi possível atualizar as respostas. Tente novamente.
            </p>}
            {rowsError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                Não foi possível consultar seus pedidos. Use "Atualizar respostas" para tentar novamente.
              </p>
            ) : ownRows === null ? (
              <p role="status" className="mt-3 text-sm text-muted-foreground">Carregando seus pedidos…</p>
            ) : ownRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Você ainda não abriu nenhuma solicitação.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {ownRows.map((r) => (
                  <RequestCard key={r.id} r={r} shared={sharedIds.has(r.id)}>
                    {sharedIds.has(r.id) ? (
                      <span className="text-xs font-semibold text-primary">
                        {r.status === "cancelada" ? "Compartilhamento encerrado pelo cancelamento" : "Compartilhado com o técnico selecionado"}
                      </span>
                    ) : r.technician_id && r.status === "aberta" ? (
                      <button type="button" disabled={sendingId === r.id} onClick={() => void shareExisting(r.id)}
                        className="min-h-11 rounded-md border border-primary px-3 text-sm font-semibold text-primary disabled:opacity-60">
                        {sendingId === r.id ? "Enviando…" : "Compartilhar descrição com o técnico escolhido"}
                      </button>
                    ) : null}
                    {(r.status === "aberta" || r.status === "aceita") && (
                      <button onClick={() => cancel(r.id)} className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground">Cancelar</button>
                    )}
                    {replyByRequest[r.id] ? (
                      <div className="w-full rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-primary">Resposta privada do técnico</p>
                        <p className="mt-2 whitespace-pre-line break-words text-sm text-foreground">{replyByRequest[r.id]!.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(replyByRequest[r.id]!.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ) : sharedIds.has(r.id) && r.status === "aberta" ? (
                      <span className="text-xs text-muted-foreground">Aguardando resposta. Atualize esta área para conferir.</span>
                    ) : null}
                  </RequestCard>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
