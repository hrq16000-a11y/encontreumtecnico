import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { listApprovedTechnicians } from "@/lib/technicians.functions";
import {
  approvedPublicReferralSpotlights, type PublicReferralSpotlight,
} from "@/lib/admin-referral-signals";

type ReadState = "idle" | "loading" | "ready" | "error";

/**
 * A deliberately bounded observation of ALREADY PUBLIC highlights.
 * This does not query invitation ownership, payments or personal contacts.
 * The parent mounts it only behind the existing admin-role gate.
 */
export function AdminReferralOverview() {
  const [status, setStatus] = useState<ReadState>("idle");
  const [highlights, setHighlights] = useState<PublicReferralSpotlight[]>([]);

  async function inspectPublicHighlights() {
    if (status === "loading") return;
    setStatus("loading");
    setHighlights([]);
    try {
      // Reuse the national public, eligible, sanitized list (max 200 fetched
      // before eligibility filtering). No privileged API, no SQL or new RPC.
      const rows = await listApprovedTechnicians({
        data: {
          especialidade: "Todas", cidade: "", regiao: "", servico: "",
          uf: "", bairro: "", prioridade: "",
        },
      });
      if (!Array.isArray(rows)) throw new Error("Public catalog unavailable");
      setHighlights(approvedPublicReferralSpotlights(rows));
      setStatus("ready");
    } catch {
      setHighlights([]);
      setStatus("error");
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-background p-4 sm:p-5"
      aria-labelledby="eut-admin-referrals-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="eut-admin-referrals-title" className="text-lg font-bold text-foreground">
            Indicações — destaques públicos
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Consulte somente perfis já publicados com o sinal de destaque por
            indicações qualificadas. É uma amostra de até 200 perfis do catálogo,
            não a contagem de todas as indicações da rede.
          </p>
        </div>
        <button type="button" onClick={() => void inspectPublicHighlights()}
          disabled={status === "loading"}
          className="min-h-11 rounded-lg border border-primary/40 px-4 py-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          {status === "loading" ? "Consultando…" :
            status === "ready" ? "Atualizar destaques" : "Consultar destaques públicos"}
        </button>
      </div>
      {status === "idle" && (
        <p className="mt-4 text-sm text-muted-foreground">
          A consulta é iniciada somente quando solicitada, sem carregar dados de convidados.
        </p>
      )}
      {status === "loading" && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">Consultando catálogo público…</p>
      )}
      {status === "error" && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Não foi possível consultar os destaques. Nenhuma contagem foi presumida.
        </p>
      )}
      {status === "ready" && (
        highlights.length > 0 ? (
          <div className="mt-4">
            <p role="status" className="text-sm font-semibold text-foreground">
              {highlights.length} perfil(is) com destaque observados neste recorte.
            </p>
            <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
              {highlights.slice(0, 20).map((profile) => (
                <li key={profile.id} className="rounded-lg border border-border px-3 py-2">
                  <Link to="/tecnicos/$tecnicoId"
                    params={{ tecnicoId: profile.public_slug || profile.id }}
                    className="text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {profile.display_name}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {profile.city}{profile.state_uf ? "/" + profile.state_uf : ""}
                  </span>
                </li>
              ))}
            </ul>
            {highlights.length > 20 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Mostrando os primeiros 20 perfis destacados encontrados neste recorte.
              </p>
            )}
          </div>
        ) : (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Nenhum destaque confirmado neste recorte. Isso não significa que
            a rede tenha zero indicações: o catálogo é limitado e o sinal público
            pode ficar indisponível sem informar o motivo.
          </p>
        )
      )}
      <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        Pontuação, associados por técnico, comissões, valores e pagamentos:
        indisponíveis até existir consulta administrativa autorizada e auditável.
        Nenhum saldo financeiro é criado ou estimado nesta visualização.
      </p>
    </section>
  );
}
