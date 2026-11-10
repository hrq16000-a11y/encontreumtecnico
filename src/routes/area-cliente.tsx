import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext, useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { RequestCard, type Req } from "../components/request-list";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";
import { consumeTriageDraft } from "@/lib/triage-draft";
import { clearTechnicianTarget, recallTechnicianTarget, rememberTechnicianTarget } from "@/lib/selected-technician-target";

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

function CanonicalClientAreaPage() {
  const { tecnico } = Route.useSearch();
  return <ClientAreaPage tecnico={tecnico} />;
}

export function ClientAreaPage({ tecnico }: { tecnico?: string | undefined }) {
  const lp2 = useContext(LP2EmbeddedContext);
  const { user, loading, roles } = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const { categories, loading: catalogLoading, error: catalogError } = useActiveCategories();
  const [form, setForm] = useState({ title: "", description: "", category: "", city: "", region: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareNow, setShareNow] = useState(false);
  const [technicianTarget, setTechnicianTarget] = useState<string | null>(tecnico ?? null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());

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
    if (!user) return;
    const { data } = await supabase.from("service_requests").select("*").eq("client_id", user.id).order("created_at", { ascending: false });
    setRows(data ?? []);
    const shares = await directDb.from("eut_direct_request_consents")
      .select("request_id").eq("client_id", user.id);
    if (!shares.error) setSharedIds(new Set((shares.data ?? []).map((entry: { request_id: string }) => entry.request_id)));
  }
  useEffect(() => { load(); }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (catalogLoading || catalogError || !categories.some((entry) => entry.slug === form.category)) {
      return setMsg("Escolha uma categoria ativa antes de guardar sua solicitação.");
    }
    setSaving(true);
    setMsg(null);
    const requestId = crypto.randomUUID();
    const { error } = await supabase.from("service_requests").insert({
      id: requestId,
      client_id: user.id,
      technician_id: technicianTarget ?? null,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      city: form.city.trim(),
      region: form.region.trim() || null,
    });
    if (error) {
      setSaving(false);
      return setMsg("Não foi possível guardar a solicitação. Tente novamente.");
    }
    window.__lovableEvents?.track?.("project.service_requested", { category: form.category, direct_to_technician: Boolean(technicianTarget) });
    if (shareNow && technicianTarget) {
      const shared = await directDb.rpc("eut_share_direct_request", { _request_id: requestId });
      setMsg(shared.error || shared.data?.status !== "enviado"
        ? "A solicitação foi salva como privada, mas o compartilhamento não foi concluído. Você pode reenviar na lista abaixo."
        : "Pedido compartilhado com o técnico escolhido. Ele poderá consultá-lo no painel. Nenhum telefone foi liberado.");
    } else {
      setMsg("Necessidade guardada somente na sua área privada. Nenhum técnico recebeu este registro.");
    }
    setSaving(false);
    setShareNow(false);
    clearTechnicianTarget();
    setTechnicianTarget(null);
    setForm({ ...form, title: "", description: "" });
    void load();
  }

  async function shareExisting(id: string) {
    if (sendingId) return;
    setSendingId(id);
    setMsg(null);
    try {
      const { data, error } = await directDb.rpc("eut_share_direct_request", { _request_id: id });
      setMsg(error || data?.status !== "enviado"
        ? "Não foi possível compartilhar. Confira o perfil escolhido ou tente novamente."
        : "Pedido enviado somente ao profissional selecionado. Contatos privados continuam protegidos.");
      if (!error) void load();
    } catch {
      setMsg("Falha de conexão ao compartilhar o pedido.");
    } finally {
      setSendingId(null);
    }
  }

  async function cancel(id: string) {
    const { error } = await supabase.rpc("set_request_status", { _id: id, _status: "cancelada" });
    if (error) setMsg("Não foi possível cancelar.");
    else load();
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Área do cliente</h1>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link to={lp2 ? "/lp2/entrar" : "/entrar"} className="font-medium text-primary underline">Entre</Link> para abrir e acompanhar suas solicitações.
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

            <h2 className="mt-10 text-lg font-semibold text-foreground">Meus registros privados</h2>
            {rows === null ? (
              <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
            ) : rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Você ainda não abriu nenhuma solicitação.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {rows.map((r) => (
                  <RequestCard key={r.id} r={r}>
                    {sharedIds.has(r.id) ? (
                      <span className="text-xs font-semibold text-primary">Enviado ao técnico selecionado</span>
                    ) : r.technician_id && r.status === "aberta" ? (
                      <button type="button" disabled={sendingId === r.id} onClick={() => void shareExisting(r.id)}
                        className="min-h-11 rounded-md border border-primary px-3 text-sm font-semibold text-primary disabled:opacity-60">
                        {sendingId === r.id ? "Enviando…" : "Compartilhar descrição com o técnico escolhido"}
                      </button>
                    ) : null}
                    {(r.status === "aberta" || r.status === "aceita") && (
                      <button onClick={() => cancel(r.id)} className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground">Cancelar</button>
                    )}
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
