import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell } from "@/components/page-placeholder";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { legacyClaimReturnPath, normalizeClaimantNote, normalizeWpPostId } from "@/lib/legacy-claim-validation";

export const Route = createFileRoute("/reivindicar-cadastro")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Recuperar cadastro antigo — Encontre um Técnico" },
      { name: "description", content: "Solicite a conferência do seu cadastro antigo com conta verificada, por Google ou e-mail e senha." },
    ],
  }),
  component: LegacyClaimPage,
});

type SuggestedLegacyProfile = {
  wp_post_id: number;
  display_name: string;
};

type ClaimSummary = {
  id: string;
  wp_post_id: number;
  status: "pendente" | "em_analise" | "rejeitado" | "vinculado";
  created_at: string;
};

// Tabela externa criada no Supabase EUT, ainda não presente no arquivo gerado pelo Lovable.
const db = supabase as unknown as SupabaseClient;
const labels: Record<ClaimSummary["status"], string> = {
  pendente: "Aguardando análise",
  em_analise: "Em verificação",
  rejeitado: "Pedido não aprovado",
  vinculado: "Titularidade associada — atualize seu perfil para publicar",
};

// One component instance per authenticated identity: private claims, notes,
// suggestions, loading state and in-flight responses cannot cross logins.
export function LegacyClaimPage() {
  const { user, roles, loading } = useAuth();
  return <LegacyClaimContent key={user?.id ?? "guest"} user={user} roles={roles} loading={loading} />;
}

function LegacyClaimContent({
  user, roles, loading,
}: Pick<ReturnType<typeof useAuth>, "user" | "roles" | "loading">) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [reference, setReference] = useState("");
  // O ID da URL apenas preenche o formulário; nunca comprova titularidade.
  useEffect(() => {
    const wpId = normalizeWpPostId(new URLSearchParams(window.location.search).get("wp") ?? "");
    if (wpId) setReference(String(wpId));
  }, []);
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ClaimSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedLegacyProfile[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggestedError, setSuggestedError] = useState(false);
  const googleLinked = !!user && (
    user.identities?.some((identity) => identity.provider === "google") ||
    user.app_metadata?.provider === "google" ||
    user.app_metadata?.providers?.includes("google")
  );

  const eligibleToClaim = googleLinked || roles.includes("tecnico");

  useEffect(() => {
    let active = true;
    if (!user?.id || !eligibleToClaim) {
      setSuggested([]);
      setSuggestedLoading(false);
      return () => { active = false; };
    }
    setSuggestedLoading(true);
    setSuggestedError(false);
    void Promise.resolve(db.rpc("eut_my_legacy_candidate_profiles")).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setSuggestedError(true);
        setSuggested([]);
      } else {
        setSuggested((data ?? []) as SuggestedLegacyProfile[]);
      }
      setSuggestedLoading(false);
    }).catch(() => {
      if (active) { setSuggestedError(true); setSuggestedLoading(false); }
    });
    return () => { active = false; };
  }, [user?.id, eligibleToClaim]);

  async function loadClaims(userId: string) {
    const { data, error } = await db.from("legacy_profile_claims")
      .select("id,wp_post_id,status,created_at")
      .eq("claimant_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (mounted.current && !error) setRows((data ?? []) as ClaimSummary[]);
  }
  useEffect(() => {
    if (user?.id) void loadClaims(user.id);
    else setRows([]);
  }, [user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !eligibleToClaim || saving) return;
    const wpId = normalizeWpPostId(reference);
    if (!wpId) {
      setFeedback("Informe o ID numérico do perfil antigo. A equipe pode ajudá-lo a localizar esse número.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    const { error } = await db.from("legacy_profile_claims").insert({
      source_key: "wordpress_20261108",
      wp_post_id: wpId,
      claimant_id: user.id,
      claimant_note: normalizeClaimantNote(note),
      status: "pendente",
    });
    // Do not update or requery an old identity after logout/account switch.
    if (!mounted.current) return;
    setSaving(false);
    if (error) {
      setFeedback(error.code === "23505"
        ? "Você já enviou uma solicitação para esse cadastro."
        : "Não foi possível registrar o pedido. Verifique o ID ou tente novamente.");
    } else {
      setFeedback("Pedido registrado. A equipe verificará sua titularidade antes de vincular os dados antigos.");
      setReference("");
      setNote("");
      await loadClaims(user.id);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Recuperar meu cadastro antigo</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Já tinha conta WordPress? O primeiro login com o mesmo e-mail confirmado procura e associa automaticamente os perfis da sua autoria. Caso o cadastro não apareça, use abaixo o pedido de recuperação manual.
        </p>
        {loading ? (
          <p className="mt-5 text-sm text-muted-foreground">Verificando sua conta…</p>
        ) : !user ? (
          <p className="mt-5 text-sm text-foreground">
            <Link to="/entrar" onClick={() => sessionStorage.setItem("eut-after-login", legacyClaimReturnPath(reference))} className="text-primary underline">Entre com Google ou e-mail e senha</Link> para solicitar o vínculo.
          </p>
        ) : !eligibleToClaim ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Para solicitar recuperação, confirme seu e-mail e escolha o tipo de conta técnico. Correspondências seguras são associadas automaticamente.
          </p>
        ) : (
          <>
            {suggestedLoading && (
              <p className="mt-5 text-sm text-muted-foreground">Procurando seus cadastros antigos pelo e-mail confirmado…</p>
            )}
            {!suggestedLoading && suggested.length > 0 && (
              <section className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Cadastros antigos encontrados">
                <h2 className="font-semibold text-foreground">Cadastros antigos encontrados para sua conta</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Identificamos perfis associados ao e-mail confirmado. A recuperação direta ocorre no primeiro login; se ela falhar, você pode solicitar ajuda pelo número do registro.
                </p>
                <ul className="mt-3 grid gap-2">
                  {suggested.map((profile) => (
                    <li key={profile.wp_post_id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                      <span className="text-sm text-foreground">{profile.display_name} <span className="text-muted-foreground">· #{profile.wp_post_id}</span></span>
                      <button type="button" onClick={() => setReference(String(profile.wp_post_id))}
                        className="min-h-10 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-accent">
                        Selecionar cadastro
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!suggestedLoading && suggestedError && (
              <p className="mt-4 text-sm text-muted-foreground">Não conseguimos consultar seus registros agora. Você ainda pode informar o ID manualmente.</p>
            )}
            <form onSubmit={submit} className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-5">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                ID numérico do cadastro WordPress
                <input required inputMode="numeric" value={reference} onChange={(event) => setReference(event.target.value)}
                  maxLength={12} placeholder="Ex.: 1234"
                  className="min-h-11 rounded-md border border-input bg-background px-3 text-base text-foreground" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Observações para a equipe (opcional)
                <textarea value={note} onChange={(event) => setNote(event.target.value)}
                  maxLength={500} rows={3}
                  placeholder="Não inclua documentos, senhas, telefones ou dados de terceiros."
                  className="rounded-md border border-input bg-background px-3 py-2 text-base text-foreground" />
              </label>
              <button type="submit" disabled={saving}
                className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? "Enviando…" : "Solicitar análise do meu cadastro"}
              </button>
            </form>
            {feedback && <p role="status" className="mt-4 text-sm text-foreground">{feedback}</p>}
            <h2 className="mt-8 text-lg font-semibold text-foreground">Minhas solicitações de vínculo</h2>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma solicitação registrada.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                    <strong className="text-card-foreground">WordPress #{row.wp_post_id}</strong>
                    <span className="ml-3 text-muted-foreground">{labels[row.status] ?? row.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 text-xs text-muted-foreground">
              A titularidade do perfil WordPress não certifica capacidade técnica. Para aparecer nas buscas, confira e complete cidade, especialidade e serviços na área do técnico.
            </p>
          </>
        )}
      </section>
    </PageShell>
  );
}
