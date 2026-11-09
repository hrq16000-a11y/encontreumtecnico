import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeVerificationNote } from "@/lib/legacy-claim-validation";

type Claim = {
  id: string;
  wp_post_id: number;
  claimant_id: string;
  claimant_note: string;
  status: "pendente" | "em_analise" | "rejeitado" | "vinculado";
  created_at: string;
  reviewed_at: string | null;
};
const db = supabase as unknown as SupabaseClient;

export function LegacyClaimReview() {
  const [rows, setRows] = useState<Claim[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await db.from("legacy_profile_claims")
      .select("id,wp_post_id,claimant_id,claimant_note,status,created_at,reviewed_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) setFeedback("Não foi possível acessar a fila de reivindicações.");
    else setRows((data ?? []) as Claim[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function update(row: Claim, status: Claim["status"]) {
    if (busy) return;
    const reviewNote = status === "vinculado"
      ? normalizeVerificationNote(notes[row.id] ?? "")
      : (notes[row.id] ?? "").trim().slice(0, 600);
    if (status === "vinculado" && !reviewNote) {
      setFeedback("Registre pelo menos 20 caracteres sobre a comprovação independente da identidade.");
      return;
    }
    if (status === "vinculado" && !window.confirm(
      "Você verificou a titularidade por canal independente? O vínculo será definitivo, mas o perfil continuará pendente de aprovação pública."
    )) return;
    setBusy(row.id);
    setFeedback(null);
    const { error } = await db.from("legacy_profile_claims")
      .update({ status, review_note: reviewNote || null })
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      setFeedback("Não foi possível concluir. Confira a identidade Google verificada, os registros históricos e as permissões.");
    } else {
      setFeedback(status === "vinculado"
        ? "Vínculo registrado. O perfil foi criado ou preservado como pendente de moderação."
        : "Situação da solicitação atualizada.");
      await load();
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5" aria-label="Pedidos de vínculo WordPress">
      <h2 className="text-lg font-semibold text-card-foreground">Reivindicações de perfis antigos</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Confira a identidade por um canal independente antes de vincular. Não use apenas um ID,
        uma mensagem ou a correspondência do e-mail como prova.
      </p>
      {feedback && <p role="status" className="mt-3 text-sm text-foreground">{feedback}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma reivindicação registrada.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-4">
              <p className="font-semibold text-foreground">Cadastro WordPress #{row.wp_post_id}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">Conta autenticada: {row.claimant_id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.status} · enviado em {new Date(row.created_at).toLocaleString("pt-BR")}
              </p>
              {row.claimant_note && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.claimant_note}</p>}
              {row.status !== "vinculado" && (
                <>
                  <label className="mt-3 grid gap-1 text-sm font-medium text-foreground">
                    Registro da verificação independente (sem documentos ou segredos)
                    <textarea value={notes[row.id] ?? ""} rows={2} maxLength={600}
                      onChange={(event) => setNotes((old) => ({ ...old, [row.id]: event.target.value }))}
                      className="rounded-md border border-input bg-background p-2 text-sm text-foreground" />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status !== "em_analise" && (
                      <button type="button" disabled={busy !== null}
                        className="min-h-11 rounded-md border border-input px-3 text-sm text-foreground disabled:opacity-50"
                        onClick={() => void update(row, "em_analise")}>Marcar em análise</button>
                    )}
                    {row.status !== "rejeitado" && (
                      <button type="button" disabled={busy !== null}
                        className="min-h-11 rounded-md border border-input px-3 text-sm text-foreground disabled:opacity-50"
                        onClick={() => void update(row, "rejeitado")}>Rejeitar</button>
                    )}
                    <button type="button" disabled={busy !== null}
                      className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      onClick={() => void update(row, "vinculado")}>
                      Vincular após comprovação
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        O vínculo não publica o técnico: só cadastros aprovados separadamente aparecem na galeria.
      </p>
    </section>
  );
}
