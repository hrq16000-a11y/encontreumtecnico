import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type ImportedProfile = {
  wp_post_id: number;
  legacy_name: string;
  legacy_bio: string | null;
  legacy_specialty: string | null;
  legacy_location1: string | null;
  legacy_location2: string | null;
  legacy_location3: string | null;
};
const db = supabase as unknown as SupabaseClient;

/** Only returns profiles that were already linked to this verified Supabase identity. */
export function LegacyProfileImport({
  userId,
  onUse,
}: {
  userId: string;
  onUse: (data: { display_name: string; bio: string }) => void;
}) {
  const [profiles, setProfiles] = useState<ImportedProfile[]>([]);
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  const activeOwnerId = useRef(userId);
  activeOwnerId.current = userId;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadedOwnerId(null);
    setProfiles([]);
    setSelected(null);
    setFailed(false);
    void Promise.resolve(db.rpc("eut_my_linked_legacy_candidate_details")).then(({ data, error }) => {
      if (!active || activeOwnerId.current !== userId) return;
      if (error) {
        setFailed(true);
        setProfiles([]);
      } else {
        setProfiles((data ?? []) as ImportedProfile[]);
      }
      setLoadedOwnerId(userId);
      setLoading(false);
    }).catch(() => {
      if (active && activeOwnerId.current === userId) {
        setProfiles([]);
        setFailed(true);
        setLoadedOwnerId(userId);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId]);

  if (loading || loadedOwnerId !== userId) return <p className="mt-3 text-xs text-muted-foreground">Consultando dados antigos associados…</p>;
  if (failed) return (
    <p className="mt-3 text-xs text-muted-foreground" role="status">
      Não foi possível recuperar os dados do perfil antigo agora. Você pode preencher o formulário normalmente.
    </p>
  );
  if (profiles.length === 0) return null;
  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-5" aria-label="Confirmar dados dos perfis WordPress">
      <h2 className="text-lg font-semibold text-card-foreground">Confirme os dados recuperados</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Encontramos {profiles.length} perfil(is) do seu WordPress anterior já associados ao seu login confirmado.
        Reaproveite apenas o que continua correto. Cidade, UF, bairro e serviços precisam ser informados por você
        antes da publicação: os dados do WordPress não são precisos o suficiente para isso.
      </p>
      <ul className="mt-4 grid gap-3">
        {profiles.map((profile) => (
          <li key={profile.wp_post_id} className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">{profile.legacy_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">Registro WordPress #{profile.wp_post_id}</p>
            {profile.legacy_specialty && <p className="mt-2 text-xs text-muted-foreground">
              Especialidade informada anteriormente: {profile.legacy_specialty}
            </p>}
            {[profile.legacy_location1, profile.legacy_location2, profile.legacy_location3]
              .filter(Boolean).length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Localização antiga (não confirmada): {[profile.legacy_location1, profile.legacy_location2, profile.legacy_location3]
                  .filter(Boolean).join(" · ")}
              </p>
            )}
            {profile.legacy_bio && <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-foreground">
              {profile.legacy_bio}
            </p>}
            <button type="button" className="mt-3 min-h-10 rounded-md border border-primary px-3 text-xs font-semibold text-primary"
              onClick={() => {
                if (activeOwnerId.current !== userId || loadedOwnerId !== userId) return;
                onUse({ display_name: profile.legacy_name, bio: profile.legacy_bio || "" });
                setSelected(profile.wp_post_id);
              }}>
              {selected === profile.wp_post_id ? "Dados carregados no formulário" : "Reutilizar nome e apresentação"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        O vínculo prova a titularidade do cadastro antigo, não uma avaliação ou certificação profissional.
        Revise o formulário abaixo e salve seus serviços e região de atendimento.
      </p>
    </section>
  );
}
