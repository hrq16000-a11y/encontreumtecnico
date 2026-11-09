import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PageShell } from "../components/page-placeholder";
import { RequestCard, type Req } from "../components/request-list";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";

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
  component: ClientAreaPage,
});

const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring";

function ClientAreaPage() {
  const { user, loading } = useAuth();
  const { tecnico } = Route.useSearch();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: CATEGORIES[0] as string, city: "", region: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("service_requests").select("*").eq("client_id", user.id).order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("service_requests").insert({
      client_id: user.id,
      technician_id: tecnico ?? null,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      city: form.city.trim(),
      region: form.region.trim() || null,
    });
    setSaving(false);
    if (error) return setMsg("Não foi possível enviar a solicitação. Tente novamente.");
    window.__lovableEvents?.track?.("project.service_requested", { category: form.category, direct_to_technician: Boolean(tecnico) });
    setMsg("Solicitação enviada. Você verá aqui quando um técnico aceitar.");
    setForm({ ...form, title: "", description: "" });
    load();
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
            <Link to="/entrar" className="font-medium text-primary underline">Entre</Link> para abrir e acompanhar suas solicitações.
          </p>
        ) : (
          <>
            <LegacyAccountActivation userId={user.id} role="cliente" />
            <h2 className="mt-6 text-lg font-semibold text-foreground">Nova solicitação</h2>
            {tecnico && <p className="mt-1 text-sm text-muted-foreground">Esta solicitação será enviada ao técnico escolhido.</p>}
            <form onSubmit={submit} className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-foreground">Resumo do problema
                <input required minLength={5} maxLength={120} className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-foreground">Descrição
                <textarea required minLength={10} maxLength={2000} rows={4} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium text-foreground">Categoria
                  <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-foreground">Cidade
                  <input required maxLength={80} className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">Bairro / região
                  <input maxLength={120} className={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </label>
              </div>
              <button disabled={saving} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Enviando…" : "Enviar solicitação"}
              </button>
              {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
            </form>

            <h2 className="mt-10 text-lg font-semibold text-foreground">Histórico</h2>
            {rows === null ? (
              <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
            ) : rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Você ainda não abriu nenhuma solicitação.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {rows.map((r) => (
                  <RequestCard key={r.id} r={r}>
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
