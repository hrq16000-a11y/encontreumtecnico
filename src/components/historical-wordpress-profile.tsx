import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-placeholder";
import type { LegacyRouteReference } from "@/lib/legacy-route.functions";

export function HistoricalWordPressProfile({
  reference,
  kind,
}: {
  reference: LegacyRouteReference | null;
  kind: "candidate" | "employer";
}) {
  const label = kind === "candidate" ? "técnico" : "empresa / contratante";

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/tecnicos" className="text-sm font-medium text-primary underline">
          Voltar ao portal
        </Link>
        {!reference ? (
          <div className="mt-7 rounded-lg border border-border bg-card p-6">
            <h1 className="text-2xl font-bold text-card-foreground">Cadastro antigo não disponível</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Este endereço não tem um registro público elegível no novo portal.
              Consulte os técnicos aprovados pela plataforma.
            </p>
          </div>
        ) : (
          <article className="mt-7 rounded-lg border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Acervo do WordPress · {label} · Em validação
            </p>
            <h1 className="mt-3 text-2xl font-bold text-card-foreground">
              {reference.display_name || "Cadastro histórico em validação"}
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Este cadastro existia no portal anterior. A identidade, as especialidades,
              as localidades atendidas e a disponibilidade ainda precisam ser confirmadas.
              O contato não está habilitado enquanto o registro não for aprovado.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Referência WordPress #{reference.wp_post_id}.
            </p>
            {kind === "candidate" && (
              <p className="mt-5 text-sm text-foreground">
                Este cadastro é seu?{" "}
                <Link to="/reivindicar-cadastro" className="font-medium text-primary underline">
                  Solicite a associação com sua nova conta
                </Link>.
              </p>
            )}
            <div className="mt-7">
              <Link to="/tecnicos" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
                Ver técnicos aprovados
              </Link>
            </div>
          </article>
        )}
      </section>
    </PageShell>
  );
}
