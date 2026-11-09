import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PageShell } from "../components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BRAZIL_STATES, validMunicipality } from "@/lib/service-taxonomy";
import { RequestCard, type Req } from "../components/request-list";

export const Route = createFileRoute("/area-tecnico")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Área do técnico — Encontre um Técnico" },
      { name: "description", content: "Painel do técnico: perfil profissional, especialidades, regiões atendidas e aprovação cadastral." },
      { property: "og:title", content: "Área do técnico — Encontre um Técnico" },
      { property: "og:description", content: "Painel do técnico: perfil profissional, especialidades, regiões atendidas e aprovação cadastral." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianAreaPage,
});

const dynamicDb = supabase as unknown as SupabaseClient;
type ServiceItem = { slug: string; category_slug: string; label: string };
type CategoryItem = { slug: string; label: string };

const STATUS_LABEL = { pendente: "Em análise", aprovado: "Aprovado — visível na busca", rejeitado: "Não aprovado", suspenso: "Suspenso pela administração" };

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
  const [form, setForm] = useState({
    display_name: "", city: "", state_uf: "", neighborhood: "", region: "",
    bio: "", specialties: [] as string[],
  });
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => {
    let mounted = true;
    Promise.all([
      dynamicDb.from("eut_service_categories").select("slug,label").eq("active", true).order("display_order"),
      dynamicDb.from("eut_service_types").select("slug,category_slug,label").eq("active", true).order("display_order"),
    ]).then(([c, s]) => {
      if (!mounted) return;
      if (c.error || s.error) { setCatalogError(true); return; }
      const list = (c.data ?? []) as CategoryItem[];
      const allowed = new Set(list.map(x => x.slug));
      setCategories(list);
      setServices(((s.data ?? []) as ServiceItem[]).filter(x => allowed.has(x.category_slug)));
      setCatalogError(false);
    }).catch(() => { if (mounted) setCatalogError(true); });
    return () => { mounted = false; };
  }, []);
  const [status, setStatus] = useState<keyof typeof STATUS_LABEL | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    dynamicDb.from("technicians").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({ display_name: data.display_name, city: data.city, state_uf: data.state_uf ?? "", neighborhood: data.neighborhood ?? "", region: data.region ?? "", bio: data.bio ?? "", specialties: data.specialties });
        setStatus(data.status as keyof typeof STATUS_LABEL);
      } else {
        setForm((f) => ({ ...f, display_name: (user.user_metadata?.["full_name"] as string) ?? "" }));
      }
    });
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!validMunicipality(form.state_uf, form.city)) return setMsg("Escolha a UF e informe uma cidade real de atendimento.");
    const catalogLabels = new Set(services.map(item => item.label));
    const validatedServices = form.specialties.filter(label => catalogLabels.has(label));
    if (!validatedServices.length) return setMsg("Escolha pelo menos um serviço ativo do catálogo.");
    if (catalogError || !services.length) return setMsg("Catálogo indisponível: cadastro não enviado.");
    setSaving(true);
    setMsg(null);
    const row = {
      user_id: user.id,
      display_name: form.display_name.trim(),
      city: form.city.trim(),
      state_uf: form.state_uf,
      neighborhood: form.neighborhood.trim() || null,
      region: form.region.trim() || null,
      bio: form.bio.trim() || null,
      specialties: validatedServices,
      status: "pendente" as const,
    };
    const { error } = status
      ? await dynamicDb.from("technicians").update(row).eq("user_id", user.id)
      : await dynamicDb.from("technicians").insert(row);
    setSaving(false);
    if (error) setMsg("Não foi possível salvar. Confira os campos e tente novamente.");
    else {
      setStatus("pendente");
      setMsg("Cadastro enviado para análise.");
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
              Seu perfil só aparece na busca depois de aprovado. Qualquer alteração volta para análise.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Já tinha perfil no portal antigo?{" "}
              <Link to="/reivindicar-cadastro" className="font-medium text-primary underline">
                Solicitar vínculo com meu cadastro WordPress
              </Link>
            </p>
            <form onSubmit={save} className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-foreground">Nome público
                <input required minLength={2} maxLength={80} className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Cidade
                  <input required maxLength={80} className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">UF
                  <select required className={input} value={form.state_uf} onChange={(e) => setForm({ ...form, state_uf: e.target.value })}>
                    <option value="">Escolha o estado</option>
                    {BRAZIL_STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-foreground">Bairro de referência
                  <input maxLength={100} className={input} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">Região / áreas atendidas
                  <input maxLength={120} className={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Serviços específicos realizados</legend>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecione os serviços reais. A antiga categoria genérica TI não será usada como comprovação.
                </p>
                {catalogError && <p role="alert" className="mt-2 text-sm text-destructive">Catálogo de serviços indisponível.</p>}
                {categories.map(category => (
                  <div key={category.slug} className="mt-3">
                    <p className="text-xs font-semibold text-foreground">{category.label}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {services.filter(item => item.category_slug === category.slug).map(item => {
                        const on = form.specialties.includes(item.label);
                        return (
                          <button type="button" key={item.slug} aria-pressed={on}
                            onClick={() => setForm({ ...form, specialties: on ? form.specialties.filter(s => s !== item.label) : [...form.specialties, item.label] })}
                            className={`min-h-11 rounded-full border px-4 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}>
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </fieldset>
              <label className="text-sm font-medium text-foreground">Apresentação
                <textarea maxLength={1000} rows={4} className={input} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
              <button disabled={saving} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
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
