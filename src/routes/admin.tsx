import { createFileRoute, Link } from "@tanstack/react-router";
import { useContext, useEffect, useState } from "react";
import { PageShell, LP2EmbeddedContext } from "../components/page-placeholder";
import { RequestCard, type Req } from "../components/request-list";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SearchMetrics } from "@/components/search-metrics";
import { LegacyReviewQueue } from "@/components/legacy-review-queue";
import { LegacyClaimReview } from "@/components/legacy-claim-review";
import { EutAdminManager } from "@/components/eut-admin-manager";
import { AdminControlHub } from "@/components/admin-control-hub";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
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
type TStatus = Tech["status"];
const TABS: { key: TStatus; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aprovado", label: "Aprovados" },
  { key: "suspenso", label: "Suspensos" },
  { key: "rejeitado", label: "Rejeitados" },
];

export function AdminPage() {
  const lp2 = useContext(LP2EmbeddedContext);
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const [techs, setTechs] = useState<Tech[] | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [msgs, setMsgs] = useState<Tables<"contact_messages">[]>([]);
  const [tab, setTab] = useState<TStatus>("pendente");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [t, r, m] = await Promise.all([
      supabase.from("technicians").select("*").order("created_at", { ascending: true }),
      supabase.from("service_requests").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("contact_messages").select("*").neq("status", "arquivada").order("created_at", { ascending: false }).limit(100),
    ]);
    if (t.error || r.error || m.error) setError("Não foi possível carregar os dados.");
    setTechs(t.data ?? []);
    setReqs(r.data ?? []);
    setMsgs(m.data ?? []);
  }

  async function setMsgStatus(id: string, status: "respondida" | "arquivada") {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
    if (error) setError("Não foi possível atualizar a mensagem.");
    else load();
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function setStatus(id: string, status: TStatus) {
    const { error } = await supabase.from("technicians").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) setError("Não foi possível atualizar o cadastro.");
    else load();
  }

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const acceptedMonth = reqs.filter((r) => r.accepted_at && new Date(r.accepted_at) >= monthStart).length;
  const openedMonth = reqs.filter((r) => new Date(r.created_at) >= monthStart).length;
  const count = (s: TStatus) => techs?.filter((t) => t.status === s).length ?? 0;
  const stats = [
    { label: "Técnicos aprovados", value: count("aprovado") },
    { label: "Cadastros pendentes", value: count("pendente") },
    { label: "Solicitações no mês", value: openedMonth },
    { label: "Aceitas no mês", value: acceptedMonth },
  ];
  const btn = "min-h-11 rounded-md px-4 text-sm font-medium disabled:opacity-50";

  return (
    <PageShell>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel administrativo</h1>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : !user ? (
          <p className="mt-4 text-sm text-muted-foreground"><Link to={lp2 ? "/lp2/entrar" : "/entrar"} className="text-primary underline">Entre</Link> com uma conta de administrador.</p>
        ) : !isAdmin ? (
          <p className="mt-4 text-sm text-muted-foreground">Sua conta não tem acesso de administrador.</p>
        ) : (
          <>
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="mt-1 text-2xl font-bold text-card-foreground">{techs ? s.value : "…"}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-sm text-muted-foreground">Os indicadores acima consideram os cadastros atuais. Os registros históricos ainda em revisão aparecem separadamente abaixo.</p>
            <AdminControlHub />
            <div id="admin-metricas" className="scroll-mt-20"><SearchMetrics /></div>
            <div id="admin-legado" className="scroll-mt-20"><LegacyReviewQueue /></div>
            <div id="admin-reivindicacoes" className="scroll-mt-20"><LegacyClaimReview /></div>
            <div id="admin-catalogo" className="scroll-mt-20"><EutAdminManager /></div>

            <h2 id="admin-tecnicos" className="mt-10 scroll-mt-20 text-lg font-semibold text-foreground">Técnicos</h2>
            <div role="tablist" className="mt-3 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground"}`}>
                  {t.label} ({count(t.key)})
                </button>
              ))}
            </div>
            {techs === null ? (
              <p className="mt-4 text-sm text-muted-foreground">Carregando cadastros…</p>
            ) : techs.filter((t) => t.status === tab).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhum cadastro nesta lista.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {techs.filter((t) => t.status === tab).map((t) => (
                  <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                    <p className="font-semibold text-card-foreground">{t.display_name}</p>
                    <p className="text-sm text-muted-foreground">{t.city}{t.region ? ` · ${t.region}` : ""} · {t.specialties.join(", ")}</p>
                    {t.bio && <p className="mt-2 text-sm text-card-foreground">{t.bio}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {t.status !== "aprovado" && <button onClick={() => setStatus(t.id, "aprovado")} className={`${btn} bg-primary text-primary-foreground`}>{t.status === "suspenso" ? "Reativar" : "Aprovar"}</button>}
                      {t.status === "pendente" && <button onClick={() => setStatus(t.id, "rejeitado")} className={`${btn} border border-input text-foreground`}>Rejeitar</button>}
                      {t.status === "aprovado" && <button onClick={() => setStatus(t.id, "suspenso")} className={`${btn} border border-input text-foreground`}>Suspender</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 id="admin-mensagens" className="mt-10 scroll-mt-20 text-lg font-semibold text-foreground">Mensagens de contato</h2>
            {msgs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma mensagem recebida.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {msgs.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-semibold text-card-foreground">{m.subject}</p>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">{m.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.name} · <a className="text-primary underline" href={`mailto:${m.email}`}>{m.email}</a> · {new Date(m.created_at).toLocaleString("pt-BR")}</p>
                    <p className="mt-2 whitespace-pre-line text-sm text-card-foreground">{m.message}</p>
                    <div className="mt-3 flex gap-2">
                      {m.status !== "respondida" && <button onClick={() => setMsgStatus(m.id, "respondida")} className={`${btn} bg-primary text-primary-foreground`}>Marcar respondida</button>}
                      {m.status !== "arquivada" && <button onClick={() => setMsgStatus(m.id, "arquivada")} className={`${btn} border border-input text-foreground`}>Arquivar</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 id="admin-solicitacoes" className="mt-10 scroll-mt-20 text-lg font-semibold text-foreground">Solicitações recentes</h2>
            {reqs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma solicitação aberta ainda.</p>
            ) : (
              <ul className="mt-3 grid gap-3">{reqs.slice(0, 50).map((r) => <RequestCard key={r.id} r={r} />)}</ul>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}
