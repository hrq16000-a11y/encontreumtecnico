import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "../components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Encontre um Técnico" },
      { name: "description", content: "Painel administrativo restrito a administradores autorizados." },
      { property: "og:title", content: "Administração — Encontre um Técnico" },
      { property: "og:description", content: "Painel administrativo restrito a administradores autorizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Tech = Tables<"technicians">;

function AdminPage() {
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const [rows, setRows] = useState<Tech[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from("technicians").select("*").order("created_at", { ascending: true });
    if (error) setError("Não foi possível carregar os cadastros.");
    setRows(data ?? []);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function decide(id: string, status: "aprovado" | "rejeitado") {
    const { error } = await supabase.from("technicians").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) setError("Não foi possível atualizar o cadastro.");
    else load();
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel administrativo</h1>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <p className="mt-4 text-sm text-muted-foreground"><Link to="/entrar" className="text-primary underline">Entre</Link> com uma conta de administrador.</p>
        ) : !isAdmin ? (
          <p className="mt-4 text-sm text-muted-foreground">Sua conta não tem acesso de administrador.</p>
        ) : (
          <>
            <h2 className="mt-6 text-lg font-semibold text-foreground">Cadastros de técnicos</h2>
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            {rows === null ? (
              <p className="mt-4 text-sm text-muted-foreground">Carregando cadastros…</p>
            ) : rows.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhum cadastro recebido ainda.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {rows.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-card-foreground">{t.display_name}</p>
                        <p className="text-sm text-muted-foreground">{t.city}{t.region ? ` · ${t.region}` : ""} · {t.specialties.join(", ")}</p>
                        {t.bio && <p className="mt-2 text-sm text-card-foreground">{t.bio}</p>}
                      </div>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">{t.status}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => decide(t.id, "aprovado")} disabled={t.status === "aprovado"} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Aprovar</button>
                      <button onClick={() => decide(t.id, "rejeitado")} disabled={t.status === "rejeitado"} className="min-h-11 rounded-md border border-input px-4 text-sm font-medium text-foreground disabled:opacity-50">Rejeitar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
