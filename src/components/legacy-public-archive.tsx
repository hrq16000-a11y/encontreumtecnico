import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { legacyAvatarUrl } from "@/lib/legacy-avatar-urls";
import { suggestLegacyDisplayName } from "@/lib/legacy-display-name";

type HistoricalProfile = {
  wp_post_id: number;
  display_name: string;
  sector_tags: string[];
  country_label: string;
  validation_status: "em_validacao";
};

const PAGE_SIZE = 24;
// A public, sanitized read-only historical snapshot, NOT public.technicians.
// It includes only profiles published on the old portal. No contact methods.
const archiveDb = supabase as unknown as SupabaseClient;

export function LegacyPublicArchive({ show }: { show: boolean }) {
  const [page, setPage] = useState(0);
  const [profiles, setProfiles] = useState<HistoricalProfile[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!show) return;
    let mounted = true;
    setLoading(true);
    setError(false);
    async function load() {
      const response = await archiveDb.from("legacy_public_archive")
        .select("wp_post_id,display_name,sector_tags,country_label,validation_status", { count: "exact" })
        .eq("validation_status", "em_validacao")
        .order("wp_post_id", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (!mounted) return;
      if (response.error) {
        setError(true);
        setCount(0);
        setProfiles([]);
      } else {
        setProfiles((response.data ?? []) as HistoricalProfile[]);
        setCount(response.count ?? 0);
      }
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [page, show]);

  return (
    <section className="mt-12 border-t border-border pt-8" aria-label="Acervo de cadastros históricos">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold tracking-tight text-foreground">Pioneiros da comunidade — pré-cadastros</h2><span className="rounded-full border border-amber-700/35 bg-amber-800/10 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">Bronze · origem histórica</span></div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Perfis históricos preservados como pré-cadastros pioneiros, aguardando confirmação do titular.
        A identidade do titular, o município e a disponibilidade ainda precisam ser atualizados.
        Cadastro histórico não significa avaliação técnica ou indicação pelo portal. Não há contato nem
        solicitação de serviço habilitados para esses registros.
      </p>
      {!show ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Os cadastros históricos ainda não têm cidade ou especialidade detalhada
          suficientes para participar dos filtros. Limpe os filtros para consultar
          o acervo provisório, sem misturá-lo aos técnicos aprovados.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {loading ? "Carregando cadastros antigos…" : error
              ? "Não foi possível carregar o acervo agora."
              : `${count} cadastro(s) recuperado(s) para conferência.`}
          </p>
          {!loading && !error && profiles.length > 0 && (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <li key={profile.wp_post_id}
                  className="eut-card-lift rounded-lg border border-amber-700/25 bg-card p-5">
                  <div className="flex items-start gap-3">
                    {legacyAvatarUrl(profile.wp_post_id) ? (
                      <img src={legacyAvatarUrl(profile.wp_post_id)!}
                        alt={`Foto publicada anteriormente no perfil ${profile.display_name}`}
                        loading="lazy" width={64} height={64}
                        className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
                    ) : (
                      <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground">
                        {profile.display_name.trim().slice(0,1).toLocaleUpperCase("pt-BR") || "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold text-card-foreground">{suggestLegacyDisplayName(profile.display_name).display}</h3>
                      {suggestLegacyDisplayName(profile.display_name).suggested && (
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          Nome sugerido · apelido original: {profile.display_name}
                        </p>
                      )}
                      <span className="mt-1 inline-flex rounded border border-amber-700/30 bg-amber-800/10 px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                        Pioneiro Bronze · pré-cadastro
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Brasil · município a confirmar
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {(profile.sector_tags.filter((tag) => !/^TI\s*[-–]\s*Informática$/i.test(tag)).length ? profile.sector_tags.filter((tag) => !/^TI\s*[-–]\s*Informática$/i.test(tag)) : ["Especialidades a confirmar"]).map((tag) => (
                      <li key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Cadastro histórico #{profile.wp_post_id}. Contato indisponível até a associação e ativação do titular.
                  </p>
                  <a
                    href={`/reivindicar-cadastro?wp=${profile.wp_post_id}`}
                    className="mt-3 inline-flex min-h-11 items-center rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Solicitar recuperação deste cadastro
                  </a>
                </li>
              ))}
            </ul>
          )}
          {!loading && !error && count > PAGE_SIZE && (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Páginas do acervo">
              <button type="button" disabled={page === 0}
                onClick={() => setPage((n) => Math.max(0, n - 1))}
                className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground disabled:opacity-40">
                Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                Página {page + 1} de {Math.ceil(count / PAGE_SIZE)}
              </span>
              <button type="button" disabled={(page + 1) * PAGE_SIZE >= count}
                onClick={() => setPage((n) => n + 1)}
                className="min-h-11 rounded-md border border-input px-4 text-sm text-foreground disabled:opacity-40">
                Próximo
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
