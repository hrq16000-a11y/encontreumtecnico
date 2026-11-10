-- EUT | recuperação de cadastros reais WordPress (P0, sem dados fictícios)
-- Fonte do catálogo: wordpress_20261108. Não altera titularidade, contatos,
-- aprovação, RLS de outras tabelas ou status de publicação dos técnicos.
-- As 20 fichas demo permanecem excluídas de qualquer sugestão/reivindicação.

-- Validação privada de existência, estado e não-demonstratividade.
-- SECURITY DEFINER necessário apenas para ler o acervo de revisão que usuários
-- normais não podem consultar; expõe somente boolean, nunca dados do titular.
CREATE OR REPLACE FUNCTION public.eut_legacy_candidate_claimable(
  _source_key text, _wp_post_id bigint
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND _source_key='wordpress_20261108'
    AND _wp_post_id > 0
    AND EXISTS (
      SELECT 1
      FROM eut_migration.legacy_directory d
      JOIN public.legacy_review_profiles v
        ON v.source_key=d.source_key AND v.wp_post_id=d.wp_post_id
      LEFT JOIN public.eut_legacy_profile_management m
        ON m.source_key=d.source_key AND m.wp_post_id=d.wp_post_id
      WHERE d.source_key=_source_key AND d.wp_post_id=_wp_post_id
        AND d.kind='candidate' AND d.source_status='publish'
        AND d.source_approved=true
        AND v.kind='candidate' AND v.demo_candidate=false
        AND coalesce(m.record_state,'pendente')<>'excluido'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.legacy_profile_claims c
      WHERE c.source_key=_source_key AND c.wp_post_id=_wp_post_id
        AND c.status='vinculado' AND c.claimant_id<>(SELECT auth.uid())
    );
$function$;
REVOKE ALL ON FUNCTION public.eut_legacy_candidate_claimable(text,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_legacy_candidate_claimable(text,bigint)
  TO authenticated;
COMMENT ON FUNCTION public.eut_legacy_candidate_claimable(text,bigint) IS
  'Boolean-only guard: published, real and not-yet-owned WordPress technician; never returns personal data.';

-- Sugestões somente após identidade CONFIRMADA e papel técnico.
-- Filtra demos, propriedade previamente vinculada e e-mails ambíguos.
CREATE OR REPLACE FUNCTION public.eut_my_legacy_candidate_profiles()
RETURNS TABLE(wp_post_id bigint, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $function$
  SELECT d.wp_post_id, left(d.title,120)::text
  FROM eut_migration.legacy_accounts a
  JOIN eut_migration.account_activation_queue q
    ON q.source_key=a.source_key AND q.wp_user_id=a.wp_user_id
  JOIN eut_migration.legacy_directory d
    ON d.source_key=a.source_key AND d.wp_user_id=a.wp_user_id
  JOIN public.legacy_review_profiles v
    ON v.source_key=d.source_key AND v.wp_post_id=d.wp_post_id
  LEFT JOIN public.eut_legacy_profile_management m
    ON m.source_key=d.source_key AND m.wp_post_id=d.wp_post_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND lower(btrim(a.wp_email))=(SELECT eut_migration.confirmed_current_email())
    AND (SELECT count(*) FROM eut_migration.legacy_accounts x
         WHERE lower(btrim(x.wp_email))=lower(btrim(a.wp_email)))=1
    AND q.intended_type='tecnico'
    AND q.state IN ('aguardando_titular','vinculada')
    AND (q.linked_auth_user_id IS NULL OR q.linked_auth_user_id=(SELECT auth.uid()))
    AND (a.auth_user_id IS NULL OR a.auth_user_id=(SELECT auth.uid()))
    AND d.kind='candidate' AND d.source_status='publish'
    AND d.source_approved=true
    AND v.kind='candidate' AND v.demo_candidate=false
    AND coalesce(m.record_state,'pendente')<>'excluido'
    AND NOT EXISTS (
      SELECT 1 FROM public.legacy_profile_claims c
      WHERE c.source_key=d.source_key AND c.wp_post_id=d.wp_post_id
        AND c.status='vinculado' AND c.claimant_id<>(SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id=(SELECT auth.uid()) AND r.role='tecnico'::public.app_role
    )
  ORDER BY d.wp_post_id
  LIMIT 25;
$function$;
REVOKE ALL ON FUNCTION public.eut_my_legacy_candidate_profiles()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_my_legacy_candidate_profiles()
  TO authenticated;

-- Inserção manual NÃO aprova nem vincula titularidade, só cria ticket pendente.
-- Preserva os guards de identidade Google/role e acrescenta evidência de perfil real.
DROP POLICY IF EXISTS "Verified technician or Google submits own pending claim"
  ON public.legacy_profile_claims;
CREATE POLICY "Verified technician or Google submits own pending claim"
ON public.legacy_profile_claims
FOR INSERT TO authenticated
WITH CHECK (
  claimant_id=(SELECT auth.uid())
  AND status='pendente'
  AND review_note IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL
  AND source_key='wordpress_20261108'
  AND public.eut_legacy_candidate_claimable(source_key,wp_post_id)
  AND (
    coalesce(((auth.jwt()->'app_metadata'->'providers') ? 'google'),false)
    OR ((auth.jwt()->'app_metadata'->>'provider')='google')
    OR public.has_role((SELECT auth.uid()),'tecnico'::public.app_role)
  )
);

COMMENT ON POLICY "Verified technician or Google submits own pending claim"
ON public.legacy_profile_claims IS
  'Claim ticket only, never auto-publication; reject demos, unpublished, excluded, nonexistent or already linked profiles.';
