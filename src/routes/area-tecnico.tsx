import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PageShell } from "../components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";

export const Route = createFileRoute("/area-tecnico")({
  head: () => ({
    meta: [
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

const STATUS_LABEL = { pendente: "Em análise", aprovado: "Aprovado — visível na busca", rejeitado: "Não aprovado" };

function TechnicianAreaPage() {
  const { user, roles, loading } = useAuth();
  const [form, setForm] = useState({ display_name: "", city: "", region: "", bio: "", specialties: [] as string[] });
  const [status, setStatus] = useState<keyof typeof STATUS_LABEL | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("technicians").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({ display_name: data.display_name, city: data.city, region: data.region ?? "", bio: data.bio ?? "", specialties: data.specialties });
        setStatus(data.status);
      } else {
        setForm((f) => ({ ...f, display_name: (user.user_metadata?.full_name as string) ?? "" }));
      }
    });
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (form.specialties.length === 0) return setMsg("Escolha pelo menos uma especialidade.");
    setSaving(true);
    setMsg(null);
    const row = {
      user_id: user.id,
      display_name: form.display_name.trim(),
      city: form.city.trim(),
      region: form.region.trim() || null,
      bio: form.bio.trim() || null,
      specialties: form.specialties,
      status: "pendente" as const,
    };
    const { error } = status
      ? await supabase.from("technicians").update(row).eq("user_id", user.id)
      : await supabase.from("technicians").insert(row);
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
            <form onSubmit={save} className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-foreground">Nome público
                <input required minLength={2} maxLength={80} className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground">Cidade
                  <input required maxLength={80} className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="text-sm font-medium text-foreground">Região / bairros
                  <input maxLength={120} className={input} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Especialidades</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const on = form.specialties.includes(c);
                    return (
                      <button type="button" key={c} aria-pressed={on}
                        onClick={() => setForm({ ...form, specialties: on ? form.specialties.filter((s) => s !== c) : [...form.specialties, c] })}
                        className={`min-h-11 rounded-full border px-4 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="text-sm font-medium text-foreground">Apresentação
                <textarea maxLength={1000} rows={4} className={input} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </label>
              <button disabled={saving} className="min-h-11 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {saving ? "Enviando…" : "Enviar para análise"}
              </button>
              {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
            </form>
          </>
        )}
      </section>
    </PageShell>
  );
}
