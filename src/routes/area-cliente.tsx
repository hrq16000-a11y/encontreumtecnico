import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { RequestCard, type Req } from "../components/request-list";
import { useAuth } from "@/hooks/use-auth";
import { ConnectedGoogleIdentity } from "@/components/connected-google-identity";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";
import { CustomerLocationButton } from "@/components/customer-location-button";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { ClientTechnicianPicker } from "@/components/client-technician-picker";
import { consumeTriageDraft } from "@/lib/triage-draft";
import { clearProtectedDraft, readProtectedDraft, saveProtectedDraft } from "@/lib/protected-session-draft";
import { clearTechnicianTarget, recallTechnicianTarget, rememberTechnicianTarget } from "@/lib/selected-technician-target";
import { containsObviousContact } from "@/lib/private-message-validation";
import { accountScopedRows, canAcceptAccountResult } from "@/lib/account-scoped-queries";
import { persistClientRequest } from "@/lib/client-request-save";
import { saveClientRequestDraftImmediately } from "@/lib/client-request-live-draft";
import { ownedRequestForAction } from "@/lib/client-request-action";
import { clientRequestStepError, type ClientRequestDraft, type ClientRequestStep } from "@/lib/client-request-wizard";
import { mayShareDirectRequest, regionalClientReturnPath, regionalRequestRecipient } from "@/lib/regional-client-intent";

export const Route = createFileRoute("/area-cliente")({
  validateSearch: zodValidator(z.object({ tecnico: z.string().optional(), modo: z.literal("regional").optional(), categoria: z.string().optional() })),
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
  const { tecnico, modo, categoria } = Route.useSearch();
  return <ClientAreaPage tecnico={tecnico} modo={modo} categoria={categoria} />;
}

export function ClientAreaPage({ tecnico, modo, categoria }: { tecnico?: string; modo?: "regional"; categoria?: string }) {
  const lp2 = useContext(LP2EmbeddedContext);
  const regionalRequest = modo === "regional";
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
  const { area: regionalHint } = useRegionalSuggestion();
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<ClientRequestStep>(1);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingSubmission = useRef<{ fingerprint: string; id: string } | null>(null);
  const draftOwnerRef = useRef<string | null>(null);
  const [draftRestoredOwnerId, setDraftRestoredOwnerId] = useState<string | null>(null);
  const [shareNow, setShareNow] = useState(false);
  const [technicianTarget, setTechnicianTarget] = useState<string | null>(regionalRequest ? null : tecnico ?? null);
  const effectiveTechnicianTarget = regionalRequestRecipient(regionalRequest, technicianTarget);
  const directShare = mayShareDirectRequest(regionalRequest, shareNow, effectiveTechnicianTarget);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [replyByRequest, setReplyByRequest] = useState<Record<string, DirectReply>>({});
  const [replyLoadError, setReplyLoadError] = useState(false);

  useEffect(() => {
    // Never reuse a previous account's unsent form, confirmation or request ID.
    // Does not erase the same-tab triage draft, which is recovered below
    // only after a verified client role has loaded.
    setDraftRestoredOwnerId(null);
    setForm({ title: "", description: "", category: "", city: "", region: "" });
    setMsg(null);
    setSaving(false);
    setStep(1);
    // A pending share belongs to the previous account. Its finally handler
    // intentionally cannot mutate another user's state, so clear it here.
    setSendingId(null);
    setShareNow(false);
    pendingSubmission.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user || !roles.includes("cliente")) {
      draftOwnerRef.current = null;
      setDraftRestoredOwnerId(null);
      return;
    }
    const existing = readProtectedDraft<ClientRequestDraft>("cliente", user.id);
    draftOwnerRef.current = user.id;
    if (existing && typeof existing.form.title === "string" &&
        typeof existing.form.description === "string" &&
        typeof existing.form.category === "string" &&
        typeof existing.form.city === "string" &&
        typeof existing.form.region === "string") {
      setForm({
        title: existing.form.title.slice(0, 120),
        description: existing.form.description.slice(0, 2000),
        category: existing.form.category.slice(0, 100),
        city: existing.form.city.slice(0, 80),
        region: existing.form.region.slice(0, 120),
      });
      setStep(existing.step as ClientRequestStep);
      setMsg("Recuperamos seu rascunho nesta aba. Confira os dados antes de enviar.");
    }
    // Never show editable blank inputs before this account's draft was checked.
    setDraftRestoredOwnerId(user.id);
  }, [user?.id, roles.join(",")]);

  useEffect(() => {
    if (!user || loading || !roles.includes("cliente") ||
        draftOwnerRef.current !== user.id ||
        (!form.title.trim() && !form.description.trim())) return;
    const owner = user.id;
    // Sync same-tab storage after edits; a quick route change must not
    // cancel the draft. Account ownership is rechecked before writing.
    if (currentUserIdRef.current === owner && draftOwnerRef.current === owner)
      saveProtectedDraft("cliente", owner, form, step);
  }, [user?.id, loading, roles.join(","), form, step]);

  useEffect(() => {
    // Keep the selected public UUID across a Google/email login redirect.
    // Only this ID is persisted and it expires automatically after 30 min.
    setShareNow(false); // receiving a different target never carries a prior opt-in
    if (regionalRequest) {
      clearTechnicianTarget();
      setTechnicianTarget(null);
      return;
    }
    if (tecnico) {
      const valid = rememberTechnicianTarget(tecnico);
      setTechnicianTarget(valid ? tecnico : null);
    } else {
      setTechnicianTarget(recallTechnicianTarget());
    }
  }, [tecnico, regionalRequest]);

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

  useEffect(() => {
    // A region suggestion never overrides the user's city or a prior triage.
    if (loading || !user || !roles.includes("cliente") || !regionalHint) return;
    setForm(previous => previous.city.trim() ? previous : {
      ...previous, city: regionalHint.city, region: previous.region || regionalHint.neighborhood,
    });
  }, [loading, user?.id, roles.join(","), regionalHint?.city, regionalHint?.uf]);

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

  const availableCategories = categories.map((entry) => entry.slug);
  const catalogUnavailable = catalogLoading || Boolean(catalogError) || categories.length === 0;

  useEffect(() => {
    // Apply only a known active category; never replace an authenticated draft.
    if (!regionalRequest || !user || !roles.includes("cliente") ||
        draftRestoredOwnerId !== user.id || catalogUnavailable ||
        !categoria || !availableCategories.includes(categoria)) return;
    setForm(current => current.category ? current : { ...current, category: categoria });
  }, [regionalRequest, categoria, user?.id, roles.join(","), draftRestoredOwnerId, catalogUnavailable, categories]);

  function saveLiveDraft(nextForm: ClientRequestDraft, nextStep: ClientRequestStep) {
    const owner = user?.id ?? null;
    const verifiedClient = Boolean(!loading && owner && roles.includes("cliente") &&
      draftOwnerRef.current === owner && currentUserIdRef.current === owner);
    // Saving inside the actual event prevents last-keystroke loss on a quick
    // route switch or app backgrounding. Consent remains volatile.
    saveClientRequestDraftImmediately(owner, verifiedClient, nextForm, nextStep);
  }

  function moveToStep(next: ClientRequestStep) {
    saveLiveDraft(form, next);
    setMsg(null);
    setStep(next);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => stepHeadingRef.current?.focus());
    }
  }
  function updateRequestField(key: keyof ClientRequestDraft, value: string) {
    const nextForm = { ...form, [key]: value };
    saveLiveDraft(nextForm, step);
    setForm(nextForm);
    // A previous authorization was for the prior description/location,
    // never silently reuse consent for amended request details.
    setShareNow(false);
  }

  function chooseTechnicianInWizard(id: string | null) {
    // Only a public UUID is retained within the tab. No draft text, GPS,
    // telephone or consent flag is stored or transmitted by selection.
    if (id) rememberTechnicianTarget(id);
    else clearTechnicianTarget();
    setTechnicianTarget(id);
    setShareNow(false); // a different recipient always requires fresh opt-in
    setMsg(null);
  }

  function advance() {
    const error = clientRequestStepError(step, form, availableCategories,
      catalogUnavailable, regionalRequest ? false : shareNow, effectiveTechnicianTarget);
    if (error) { setMsg(error); return; }
    if (step < 4) moveToStep((step + 1) as ClientRequestStep);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || !roles.includes("cliente") || saving) return;
    if (step < 4) { advance(); return; }
    const problemError = clientRequestStepError(1, form, availableCategories, catalogUnavailable, regionalRequest ? false : shareNow, effectiveTechnicianTarget);
    const locationError = clientRequestStepError(2, form, availableCategories, catalogUnavailable, regionalRequest ? false : shareNow, effectiveTechnicianTarget);
    const recipientError = clientRequestStepError(3, form, availableCategories, catalogUnavailable, regionalRequest ? false : shareNow, effectiveTechnicianTarget);
    if (problemError || locationError || recipientError) {
      setMsg(problemError || locationError || recipientError);
      return;
    }
    if (catalogLoading || catalogError || !categories.some((entry) => entry.slug === form.category)) {
      return setMsg("Escolha uma categoria ativa antes de guardar sua solicitação.");
    }
    if (directShare &&
        containsObviousContact(`${form.title} ${form.description} ${form.city} ${form.region}`)) {
      return setMsg("Remova telefone, e-mail, links e endereço completo antes de compartilhar. Nenhum técnico recebeu seus dados.");
    }
    // Reuse the same UUID if a network timeout made the first attempt
    // inconclusive. Retrying must not silently create a duplicate request.
    const owner = user.id;
    const fingerprint = JSON.stringify([owner, effectiveTechnicianTarget,
      form.title.trim(), form.description.trim(), form.category, form.city.trim(), form.region.trim()]);
    const requestId = pendingSubmission.current?.fingerprint === fingerprint
      ? pendingSubmission.current.id : crypto.randomUUID();
    pendingSubmission.current = { fingerprint, id: requestId };
    const shouldShare = directShare;

    setSaving(true);
    setMsg(null);
    try {
      const result = await persistClientRequest(
        async () => {
          const { error } = await supabase.from("service_requests").insert({
            id: requestId,
            client_id: owner,
            technician_id: effectiveTechnicianTarget,
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
      clearProtectedDraft("cliente", owner);
      window.__lovableEvents?.track?.("project.service_requested", {
        category: form.category, direct_to_technician: shouldShare,
      });
      setShareNow(false);
      clearTechnicianTarget();
      setTechnicianTarget(null);
      setForm((current) => ({ ...current, title: "", description: "" }));
      setStep(1);
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
            <Link to={lp2 ? "/lp2/entrar" : "/entrar"} onClick={() => {
              if (!regionalRequest) return;
              try { sessionStorage.setItem("eut-after-login", regionalClientReturnPath(categoria)); } catch { /* Storage unavailable. */ }
            }} className="font-medium text-primary underline">Entre com uma conta de cliente</Link> para abrir e acompanhar suas solicitações.
          </p>
        ) : draftRestoredOwnerId !== user.id ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status" aria-live="polite" aria-busy="true">
            Recuperando seu rascunho privado…
          </p>
        ) : (
          <>
            <ConnectedGoogleIdentity user={user} />
            <h2 className="mt-6 text-lg font-semibold text-foreground">{regionalRequest ? "Registrar pedido regional" : "Registrar minha necessidade"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {regionalRequest ? "Descreva sua necessidade e guarde o pedido no histórico privado. Nenhum perfil externo não reivindicado será notificado ou apresentado como técnico cadastrado." : "Em quatro passos, você descreve o serviço, informa apenas sua região e decide se quer compartilhar com o profissional escolhido. Nenhuma mensagem é enviada automaticamente e nenhum contato privado é liberado."}
            </p>
            <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Solicitação guiada · Passo {step} de 4
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2" role="progressbar"
                  aria-label="Progresso da solicitação do cliente"
                  aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
                  {(["Problema", "Localização", "Profissional", "Confirmar"] as const).map((label, index) => (
                    <div key={label} className="min-w-0">
                      <div className={`h-1.5 rounded-full ${index + 1 <= step ? "bg-primary" : "bg-muted"}`} />
                      <span className={`mt-2 block break-words text-center text-[11px] ${index + 1 === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <h3 ref={stepHeadingRef} tabIndex={-1} className="mt-5 text-xl font-bold text-foreground outline-none sm:text-2xl">
                  {step === 1 ? "Qual problema você precisa resolver?" :
                    step === 2 ? "Onde o atendimento será realizado?" :
                    step === 3 ? (regionalRequest ? "Guardar meu pedido regional" : "Quem poderá visualizar sua solicitação?") :
                    "Confira sua solicitação"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step === 1 ? "Descreva o que aconteceu e selecione uma categoria. Não informe telefone ou endereço completo." :
                    step === 2 ? "Preencha cidade e região aproximada. O GPS é opcional e solicita sua permissão." :
                    step === 3 ? (regionalRequest ? "Ninguém será avisado automaticamente. O pedido permanece no seu histórico privado." : "Você pode guardar o pedido só para você, ou compartilhar com o técnico selecionado mediante autorização.") :
                    "O pedido será salvo primeiro na sua área. Só será enviado ao técnico escolhido se você autorizar."}
                </p>
              </div>
              {step === 1 && (
                <div className="grid gap-4">
                  <label className="text-sm font-medium text-foreground">Resumo do problema
                    <input minLength={5} maxLength={120} className={input} value={form.title}
                      autoComplete="off" placeholder="Ex.: Wi-Fi parou de funcionar"
                      onChange={(e) => updateRequestField("title", e.target.value)} />
                  </label>
                  <label className="text-sm font-medium text-foreground">Descrição do problema
                    <textarea minLength={10} maxLength={2000} rows={5} className={input}
                      value={form.description} placeholder="Explique os sintomas e o serviço desejado, sem contatos pessoais"
                      onChange={(e) => updateRequestField("description", e.target.value)} />
                  </label>
                  <label className="text-sm font-medium text-foreground">Categoria do serviço
                    <select className={input} value={form.category} disabled={catalogUnavailable}
                      onChange={(e) => updateRequestField("category", e.target.value)}>
                      <option value="">Selecione uma categoria</option>
                      {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                    </select>
                    {catalogError && <span role="alert" className="mt-2 block text-sm text-destructive">
                      Catálogo indisponível. Recarregue a página para tentar novamente.
                    </span>}
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4">
                  {regionalHint && <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <strong className="text-foreground">Cidade sugerida: {regionalHint.city}/{regionalHint.uf}.</strong>
                    {" "}Estimativa aproximada, não sua localização exata. Confira antes de enviar.
                  </p>}
                  <CustomerLocationButton onLocated={(area, source) => {
                    // Automatic hints never override a city the client typed.
                    const nextForm = source === "automatic" && form.city.trim() ? form :
                      { ...form, city: area.city, region: area.neighborhood };
                    if (nextForm !== form) {
                      saveLiveDraft(nextForm, step);
                      setForm(nextForm);
                      setShareNow(false);
                    }
                  }} />
                  <label className="text-sm font-medium text-foreground">Cidade do atendimento
                    <input maxLength={80} className={input} value={form.city}
                      autoComplete="address-level2" placeholder="Ex.: Curitiba"
                      onChange={(e) => updateRequestField("city", e.target.value)} />
                  </label>
                  <label className="text-sm font-medium text-foreground">Bairro ou região aproximada (opcional)
                    <input maxLength={120} className={input} value={form.region}
                      autoComplete="address-level3" placeholder="Ex.: Centro"
                      onChange={(e) => updateRequestField("region", e.target.value)} />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Não precisamos do número da sua casa. A localização exata do GPS
                    não é armazenada nem compartilhada pelo portal.
                  </p>
                </div>
              )}
              {step === 3 && (
                <div className="grid gap-3">
                  {regionalRequest ? (
                    <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                      <p className="font-semibold">Solicitação regional sem destinatário</p>
                      <p className="mt-2 text-muted-foreground">Você guardará esta necessidade somente na sua conta. Candidatos externos não reivindicados não recebem pedidos nem têm contato liberado.</p>
                    </div>
                  ) : <ClientTechnicianPicker
                    category={form.category}
                    city={form.city}
                    selectedId={technicianTarget}
                    onSelect={chooseTechnicianInWizard}
                  />}
                  {!regionalRequest && technicianTarget && (
                    <div role="status" className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                      <p className="text-sm font-semibold text-foreground">Você escolheu um técnico</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Essa escolha não envia o pedido. Para solicitar o compartilhamento,
                        marque a autorização abaixo e confirme na última etapa.
                        Nenhum telefone será liberado.
                      </p>
                    </div>
                  )}
                  {!regionalRequest && technicianTarget && (
                    <label className="flex min-h-12 items-start gap-3 rounded-xl border border-primary/25 bg-card p-4 text-sm text-foreground">
                      <input type="checkbox" checked={shareNow} onChange={(e) => setShareNow(e.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 accent-primary" />
                      <span>
                        Autorizo compartilhar o título, a descrição, a categoria e a localidade informada
                        somente com o técnico selecionado. Não incluo telefone, e-mail ou endereço completo.
                        Sei que isso não é uma contratação nem libera contato privado.
                      </span>
                    </label>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {directShare ? "Escolha atual: salvar e enviar somente ao profissional selecionado." :
                      "Escolha atual: guardar o pedido apenas no seu histórico privado."}
                  </p>
                </div>
              )}
              {step === 4 && (
                <div className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm">
                  <p className="font-semibold text-foreground">{form.title.trim()}</p>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">{form.description.trim()}</p>
                  <p className="text-muted-foreground">
                    Categoria: {categories.find((entry) => entry.slug === form.category)?.label ?? form.category}
                  </p>
                  <p className="text-muted-foreground">
                    Região: {form.city.trim()}{form.region.trim() ? ` · ${form.region.trim()}` : ""}
                  </p>
                  <p className="rounded-lg bg-muted/40 p-3 font-medium text-foreground">
                    {directShare
                      ? "Ao confirmar, o pedido será salvo e o compartilhamento será solicitado somente ao técnico escolhido."
                      : "Ao confirmar, este pedido será guardado na sua área privada. Nenhum técnico será avisado."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Não há contratação, cobrança ou liberação de telefone nesta etapa.
                    É possível voltar e corrigir os dados antes de salvar.
                  </p>
                </div>
              )}
              {msg && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">{msg}</p>}
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:shadow-none">
                {step > 1 && (
                  <button type="button" onClick={() => moveToStep((step - 1) as ClientRequestStep)}
                    disabled={saving} className="min-h-12 shrink-0 rounded-xl border border-border px-5 text-sm font-semibold text-foreground disabled:opacity-60">
                    Voltar
                  </button>
                )}
                {step < 4 ? (
                  <button type="button" onClick={advance} disabled={saving}
                    className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    Continuar <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button type="submit" disabled={saving || catalogUnavailable}
                    className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                    {saving ? "Salvando…" : directShare ? "Salvar e enviar ao técnico escolhido" : "Guardar necessidade na minha área"}
                  </button>
                )}
              </div>
            </form>

            <details className="mt-5 rounded-xl border border-border bg-card p-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary">
                Já tinha uma conta no site antigo? Recuperar cadastro
              </summary>
              <div className="mt-4">
                <LegacyAccountActivation userId={user.id} role="cliente" />
              </div>
            </details>

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
