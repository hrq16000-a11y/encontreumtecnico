import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell } from "../components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { useActiveServices } from "@/hooks/use-active-services";
import { BRAZIL_STATES, validMunicipality } from "@/lib/service-taxonomy";
import { LegacyAccountActivation } from "@/components/legacy-account-activation";
import { LegacyProfileImport } from "@/components/legacy-profile-import";
import { TechnicianPresence } from "@/components/technician-presence";
import { RequestCard, type Req } from "../components/request-list";

export const Route = createFileRoute("/area-tecnico")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Área do técnico — Encontre um Técnico" },
      { name: "description", content: "Painel do técnico: cadastro gratuito, confirmação dos dados WordPress e especialidades atendidas." },
      { property: "og:title", content: "Área do técnico — Encontre um Técnico" },
      { property: "og:description", content: "Painel do técnico: cadastro gratuito, confirmação dos dados WordPress e especialidades atendidas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianAreaPage,
});

const STATUS_LABEL = { pendente: "Complete seus dados para publicar", aprovado: "Publicado — visível na busca", rejeitado: "Oculto", suspenso: "Visibilidade suspensa" };
const activationDb = supabase as unknown as SupabaseClient;

function TechnicianRequests() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function load() {
    const { data } = await supabase.from("service_requests").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);
  async function act(r: Req, s: "aceita" | "recusada" | "concluida") {
    const { error } = await supabase.rpc("set_request_status", { _id: r.id, _status: s });
    if (error) return setErr("Não foi possível atualizar a solicitação.");
    if (s === "aceita") window.__lovableEvents?.track?.("project.service_accepted", { category: r.category });
    load();
  }
  const btn = "min-h-11 rounded-md px-4 text-sm font-medium";
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-foreground">Solicitações</h2>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      {rows === null ? <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        : rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma solicitação disponível no momento.</p>
        : (
          <ul className="mt-3 grid gap-3">
            {rows.map((r) => (
              <RequestCard key={r.id} r={r}>
                {r.status === "aberta" && <button onClick={() => act(r, "aceita")} className={`${btn} bg-primary text-primary-foreground`}>Aceitar</button>}
                {r.status === "aberta" && r.technician_id && <button onClick={() => act(r, "recusada")} className={`${btn} border border-input text-foreground`}>Recusar</button>}
                {r.status === "aceita" && <button onClick={() => act(r, "concluida")} className={`${btn} bg-primary text-primary-foreground`}>Marcar como concluída</button>}
              </RequestCard>
            ))}
          </ul>
        )}
    </section>
  );
}

function TechnicianAreaPage() {
  const { user, roles, loading } = useAuth();
  const { categories, loading: catalogLoading, error: catalogError } = useActiveCategories();
  const { services, loading: servicesLoading, error: servicesError } = useActiveServices();
  const [form, setForm] = useState({ display_name: "", state_uf: "", city: "", neighborhood: "", region: "", bio: "", specialties: [] as string[], service_slugs: [] as string[] });
  const [status, setStatus] = useState<keyof typeof STATUS_LABEL | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("technicians").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({ display_name: data.display_name, state_uf: data.state_uf ?? "", city: data.city, neighborhood: data.neighborhood ?? "", region: data.region ?? "", bio: data.bio ?? "", specialties: data.specialties, service_slugs: data.service_slugs ?? [] });
        setStatus(data.status);
      } else {
        setForm((f) => ({ ...f, display_name: (user.user_metadata?.["full_name"] as string) ?? "" }));
      }
    });
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!validMunicipality(form.state_uf, form.city)) return setMsg("Selecione a UF e informe uma cidade válida para sua área de atendimento.");
    if (catalogLoading || catalogError || !categories.length) return setMsg("O catálogo está indisponível. Não é possível validar especialidades agora.");
    if (form.specialties.length === 0) return setMsg("Escolha pelo menos uma especialidade.");
    if (form.specialties.some((slug) => !categories.some((c) => c.slug === slug))) return setMsg("Selecione apenas categorias ativas do catálogo.");
    if (servicesLoading || servicesError) return setMsg("O catálogo de serviços não está disponível. Tente novamente.");
    if (form.service_slugs.length === 0) return setMsg("Escolha pelo menos um serviço específico que você executa.");
    if (form.service_slugs.some((slug) => !services.some((service) => service.slug === slug && form.specialties.includes(service.category_slug)))) return setMsg("Os serviços precisam pertencer às categorias selecionadas e estar ativos.");
    setSaving(true);
    setMsg(null);
    try {
      // Só a RPC do servidor define o status público; a tela não pode aprovar um perfil incompleto.
      const { data, error } = await activationDb.rpc("eut_publish_my_technician", {
        _display_name: form.display_name.trim(),
        _state_uf: form.state_uf,
        _city: form.city.trim(),
        _neighborhood: form.neighborhood.trim() || null,
        _region: form.region.trim() || null,
        _bio: form.bio.trim() || null,
        _specialties: form.specialties,
        _service_slugs: form.service_slugs,
      });
      if (error) {
        setMsg("Não foi possível publicar. Confira cidade, categorias e serviços e tente novamente.");
      } else if (data?.state === "bloqueado_por_seguranca") {
        setMsg("Seu perfil tem uma restrição de segurança e não pode ser reativado automaticamente. Entre em contato.");
      } else if (data?.state === "publicado") {
        setStatus("aprovado");
        setMsg("Perfil publicado automaticamente. Os dados profissionais são declarados por você; não há avaliação técnica do portal.");
      } else {
        setMsg("A publicação não foi concluída. Tente novamente.");
      }
    } catch {
      setMsg("Falha de conexão ao publicar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Área do técnico</h1>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user || !roles.includes("tecnico") ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Entre com uma conta de técnico para editar seu cadastro.{" "}
            <Link to="/entrar" className="font-medium text-primary underline">Entrar</Link>
          </p>
        ) : (
          <>
            {status && (
              <p className="mt-3 inline-block rounded-md bg-muted px-3 py-1 text-sm text-foreground">
                Situação: <strong>{STATUS_LABEL[status]}</strong>
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Seu cadastro é gratuito. Ao confirmar sua cidade, especialidades e serviços, seu perfil é publicado automaticamente, sem avaliação da sua capacidade técnica pelo portal.
            </p>
            {status === "aprovado" && <TechnicianPresence userId={user.id} />}
            <LegacyAccountActivation userId={user.id} role="tecnico" />
            <LegacyProfileImport userId={user.id}
              onUse={(data) => setForm((current) => ({
                ...current,
                display_name: data.display_name || current.display_name,
                bio: data.bio || current.bio,
              }))}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Não encontrou o cadastro que era seu?{" "}
              <Link to="/reivindicar-cadastro" className="font-medium text-primary underline">
                Informar um perfil antigo manualmente
              </Link>
            </p>
            <form onSubmit={save} className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-foreground">Nome público
                <input required minLength={2} maxLength={80} className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Estado (UF)
                  <select required className={input} value={form.state_uf} onChange={(e) => setForm({ ...form, state_uf: e.target.value })}>
                    <option value="">Selecione o estado</option>
                    {BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-foreground">Município
                  <input required maxLength={80} className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex.: Curitiba" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Bairro de referência (opcional)
                  <input maxLength={80} className={input} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">Regiões e outros bairros atendidos
                  <input maxLength={120} className={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Especialidades</legend>
                {catalogLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando categorias…</p>}
                {catalogError && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível carregar o catálogo. Recarregue a página.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const on = form.specialties.includes(c.slug);
                    return (
                      <button type="button" key={c.slug} aria-pressed={on}
                        onClick={() => setForm({ ...form, specialties: on ? form.specialties.filter((s) => s !== c.slug) : [...form.specialties, c.slug], service_slugs: on ? form.service_slugs.filter((slug) => services.find((service) => service.slug === slug)?.category_slug !== c.slug) : form.service_slugs })}
                        className={`min-h-11 rounded-full border px-4 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Serviços que você realmente executa</legend>
                <p className="mt-1 text-xs text-muted-foreground">Selecione os serviços que você realmente executa dentro das categorias. Seu perfil completo pode ser publicado automaticamente; o portal não certifica competência técnica.</p>
                {servicesLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando serviços…</p>}
                {servicesError && <p role="alert" className="mt-2 text-sm text-destructive">Serviços indisponíveis. Recarregue a página.</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {services.filter((service) => form.specialties.includes(service.category_slug)).map((service) => (
                    <label key={service.slug} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={form.service_slugs.includes(service.slug)}
                        onChange={(e) => setForm((old) => ({ ...old, service_slugs: e.target.checked ? [...old.service_slugs, service.slug] : old.service_slugs.filter((slug) => slug !== service.slug) }))} />
                      <span>{service.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="text-sm font-medium text-foreground">Apresentação
                <textarea maxLength={1000} rows={4} className={input} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
              <button disabled={saving || catalogLoading || catalogError || servicesLoading || servicesError || categories.length === 0} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Enviando…" : "Enviar para análise"}
              </button>
              {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
            </form>
            {status === "aprovado" && <TechnicianRequests />}
          </>
        )}
      </section>
    </PageShell>
  );
}
