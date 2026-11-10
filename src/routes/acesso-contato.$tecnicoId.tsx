import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageShell, EmptyState } from "@/components/page-placeholder";
import { getApprovedTechnician } from "@/lib/technicians.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const db = supabase as unknown as SupabaseClient;
type Quote = {
  status: "aguardando_integracao_pagamento" | "limite_diario_atingido";
  price_cents: number;
  currency: "BRL";
  timezone: "America/Sao_Paulo";
  commercial_hours: string;
  contacts_per_purchase: number;
  daily_max_contacts: number;
  contacts_accessed_today: number;
  contacts_remaining_today: number;
  payment_available: false;
  contact_released: false;
};

function isQuote(input: unknown): input is Quote {
  if (!input || typeof input !== "object") return false;
  const value = input as Partial<Quote>;
  return (value.status === "aguardando_integracao_pagamento" || value.status === "limite_diario_atingido")
    && (value.price_cents === 999 || value.price_cents === 2999)
    && value.currency === "BRL" && value.payment_available === false
    && value.contact_released === false
    && value.contacts_per_purchase === 1
    && value.daily_max_contacts === 2
    && typeof value.contacts_remaining_today === "number";
}

export const Route = createFileRoute("/acesso-contato/$tecnicoId")({
  loader: ({ params }) => UUID.test(params.tecnicoId)
    ? getApprovedTechnician({ data: { id: params.tecnicoId } }) : null,
  head: () => ({
    meta: [
      { title: "Acesso ao contato — Encontre um Técnico" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Condições transparentes de acesso ao contato de profissionais independentes." },
    ],
  }),
  component: ContactAccessPage,
});

function ContactAccessPage() {
  const technician = Route.useLoaderData();
  const { user, roles, loading: authLoading } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!technician || authLoading || !user || !roles.includes("cliente")) {
      setQuote(null);
      return;
    }
    let active = true;
    setFetching(true);
    setError(null);
    void Promise.resolve(db.rpc("eut_contact_access_quote", { _technician_id: technician.id }))
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError || !isQuote(data)) {
          setError("Não foi possível consultar as condições de acesso. Recarregue a página.");
        } else {
          setQuote(data);
        }
        setFetching(false);
      }).catch(() => {
        if (active) {
          setError("A consulta de preços está temporariamente indisponível.");
          setFetching(false);
        }
      });
    return () => { active = false; };
  }, [technician?.id, user?.id, authLoading, roles.join(",")]);

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 py-12">
        <Link to="/tecnicos" className="text-sm font-medium text-primary hover:underline">
          ← Voltar à busca de técnicos
        </Link>
        {!technician ? (
          <EmptyState title="Profissional indisponível"
            description="Este perfil não está publicado ou não pode receber solicitações de acesso neste momento." />
        ) : (
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Conveniência digital</span>
            <h1 className="mt-2 text-2xl font-bold text-card-foreground">Acesso ao contato de {technician.display_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {technician.city}{technician.state_uf ? `/${technician.state_uf}` : ""}
              {technician.neighborhood ? ` · ${technician.neighborhood}` : ""}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              O valor da plataforma corresponde ao acesso ao contato, e não à visita, orçamento
              ou execução do trabalho. Você conversa e negocia diretamente com o prestador.
              Os profissionais realizam cadastro livre, sem certificação técnica pelo portal.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Das 9h às 17h59 — horário de São Paulo</p>
                <p className="mt-1 text-2xl font-bold text-foreground">R$ 9,99</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Das 18h às 8h59 — horário de São Paulo</p>
                <p className="mt-1 text-2xl font-bold text-foreground">R$ 29,99</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Regra prevista: 1 contato por aquisição e no máximo 2 contatos diferentes por
              cliente em cada dia civil, com controle no servidor. Não existe acesso ilimitado a números.
            </p>
            {authLoading ? (
              <p className="mt-5 text-sm text-muted-foreground">Consultando autenticação…</p>
            ) : !user || !roles.includes("cliente") ? (
              <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-sm text-foreground">
                  Para consultar a cotação específica e, futuramente, adquirir acesso,
                  entre com uma conta de cliente confirmada.
                </p>
                <Link to="/entrar" className="mt-3 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  Entrar ou cadastrar-me
                </Link>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-border bg-muted/20 p-4">
                {fetching && <p role="status" className="text-sm text-muted-foreground">Consultando valor atual…</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {quote && (
                  <>
                    <p className="text-sm text-foreground">
                      Valor informativo neste horário: <strong>{(quote.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {quote.contacts_remaining_today} contato(s) restante(s) no limite diário.
                      A cotação não garante o preço de uma futura transação.
                    </p>
                  </>
                )}
                <p className="mt-3 text-sm font-semibold text-foreground">
                  O checkout ainda não está habilitado. Nenhum pagamento será cobrado nesta página.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O número privado deste profissional permanece protegido e só poderá ser liberado
                  após confirmação real de pagamento por um provedor financeiro integrado.
                </p>
              </div>
            )}
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              O cadastro é gratuito para o técnico. O acesso ao contato não garante disponibilidade,
              negociação ou contratação. Consulte os{" "}
              <Link to="/termos" className="text-primary underline">termos de uso</Link> e a{" "}
              <Link to="/pagamentos-e-reembolsos" className="text-primary underline">política de pagamentos e reembolsos</Link>.
              Reclamações sobre o serviço digital e solicitações de privacidade não dependem de compra.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
