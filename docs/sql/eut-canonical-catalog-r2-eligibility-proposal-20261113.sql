-- PROPOSAL R2 ONLY. NEVER apply to hosted Supabase or production.
-- Requires R1 from PR #256, live-schema/RLS review, backup and separate approval.
-- No data migration, no backfill, no identity synthesis and no contact/payment API.
-- Cutover is NOT complete until the #255 SSR candidate query and null-safe
-- public card are reviewed and released independently. The current #255 query
-- still requires status='aprovado', so this SQL must NEVER be deployed alone.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('eut_moderation.catalog_provenance') IS NULL
     OR to_regclass('eut_moderation.catalog_private_contacts') IS NULL
     OR to_regclass('public.eut_admin_management_log') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute
       WHERE attrelid='public.technicians'::regclass
         AND attname='catalog_enabled' AND NOT attisdropped
     )
  THEN
    RAISE EXCEPTION 'R2 requires reviewed R1 canonical catalog';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='technicians'
      AND policyname='eut_public_visibility_anon_guard'
  ) THEN
    RAISE EXCEPTION 'R2 requires prior anonymous visibility guard';
  END IF;
END $preflight$;

-- Only this helper is allowed to reason over PRIVATE provenance/contact/audit.
-- Its owner must have suitable BYPASSRLS, and eut_visibility must stay OUT
-- of PostgREST exposed schemas. Keep existing public RLS/owner admin reads.
CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible(
  _technician_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog'
AS $eligible$
 SELECT EXISTS (
   SELECT 1 FROM public.technicians t
   WHERE t.id=_technician_id
     -- Old rows have NULL after R1. Explicit false always vetoes.
     AND t.catalog_enabled IS DISTINCT FROM false
     AND (
       -- Historical, Auth-owned publication remains subject to old checks.
       (
         t.user_id IS NOT NULL
         AND t.status='aprovado'::public.approval_status
         AND NOT EXISTS (
           SELECT 1 FROM eut_moderation.blocked_accounts b
           WHERE b.user_id=t.user_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.eut_technician_private_contacts c
           JOIN eut_moderation.blocked_phones b ON
             b.phone_digits=pg_catalog.regexp_replace(
               coalesce(c.phone_e164,''),'[^0-9]','','g')
           WHERE c.user_id=t.user_id
             AND c.phone_e164 IS NOT NULL
             AND pg_catalog.regexp_replace(c.phone_e164,'[^0-9]','','g')<>''
         )
       )
       OR
       -- Auth-less status='pendente' is NOT a general public permission.
       -- A new, explicitly enabled R1 canonical record with BOTH private
       -- provenance AND an audited administrator creation is required.
       (
         t.user_id IS NULL
         AND t.catalog_enabled IS true
         AND t.status='pendente'::public.approval_status
         AND t.catalog_origin IN ('admin_manual','external_import','wordpress')
         AND EXISTS (
           SELECT 1 FROM eut_moderation.catalog_provenance p
           WHERE p.technician_id=t.id
             AND p.catalog_origin=t.catalog_origin
         )
         AND EXISTS (
           SELECT 1 FROM public.eut_admin_management_log log
           WHERE log.target_type='technician'
             AND log.target_key=t.id::text
             AND log.action='catalog_created'
             AND log.actor_id IS NOT NULL
             AND log.after_state->>'origin'=t.catalog_origin
             AND log.after_state->>'catalog_enabled'='true'
             AND log.after_state->>'auth_user_created'='false'
         )
         AND NOT EXISTS (
           SELECT 1 FROM eut_moderation.catalog_private_contacts c
           JOIN eut_moderation.blocked_phones b ON
             b.phone_digits=pg_catalog.regexp_replace(
               coalesce(c.phone_e164,''),'[^0-9]','','g')
           WHERE c.technician_id=t.id
             AND c.phone_e164 IS NOT NULL
             AND pg_catalog.regexp_replace(c.phone_e164,'[^0-9]','','g')<>''
         )
       )
     )
 );
$eligible$;

-- R1 already installed both role grants. Do not enlarge the exposed schema.
REVOKE ALL ON FUNCTION
 eut_visibility.eut_public_technician_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
 eut_visibility.eut_public_technician_eligible(uuid) TO anon,authenticated;

-- All public visibility policies delegate to ONE authoritative predicate.
-- This is essential: requiring approved status outside the helper would
-- make audited Auth-less 'pendente' rows invisible; dropping the restrictive
-- guard could accidentally expose unrelated, unaudited pending rows.
DROP POLICY IF EXISTS "Public reads approved" ON public.technicians;
CREATE POLICY "Public reads approved" ON public.technicians
 AS PERMISSIVE FOR SELECT TO anon,authenticated
 USING(eut_visibility.eut_public_technician_eligible(id));

DROP POLICY IF EXISTS eut_public_visibility_anon_guard ON public.technicians;
CREATE POLICY eut_public_visibility_anon_guard ON public.technicians
 AS RESTRICTIVE FOR SELECT TO anon
 USING(eut_visibility.eut_public_technician_eligible(id));

DROP POLICY IF EXISTS eut_public_visibility_auth_guard ON public.technicians;
CREATE POLICY eut_public_visibility_auth_guard ON public.technicians
 AS RESTRICTIVE FOR SELECT TO authenticated
 USING(
   eut_visibility.eut_public_technician_eligible(id)
   OR (auth.uid() IS NOT NULL AND auth.uid()=user_id)
   OR public.has_role(auth.uid(),'admin'::public.app_role)
 );

-- Keep the exact legacy signature, the invoker security model and <=500
-- bounded candidate IDs. Return IDs ONLY, never phones, source keys or bans.
CREATE OR REPLACE FUNCTION public.eut_public_eligible_technician_ids(
  _ids uuid[]
)
RETURNS TABLE(technician_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='pg_catalog'
AS $rpc$
  SELECT t.id AS technician_id
  FROM public.technicians t
  WHERE _ids IS NOT NULL
    AND pg_catalog.cardinality(_ids) BETWEEN 1 AND 500
    AND t.id=ANY(_ids)
    AND eut_visibility.eut_public_technician_eligible(t.id)
  GROUP BY t.id ORDER BY t.id;
$rpc$;

REVOKE ALL ON FUNCTION public.eut_public_eligible_technician_ids(uuid[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_eligible_technician_ids(uuid[])
  TO anon,authenticated;

COMMIT;

-- INTENTIONAL NON-GOALS / RELEASE BLOCKERS:
-- * R1 administrative enablement is not a paid entitlement or online status.
-- * The #255 SSR query still rejects pending status: cut over DB and SSR as
--   one separately authorized release, with null-safe name/city presentation.
-- * The R1 city/coverage trigger forbids nonempty coverage_city_ids on
--   pending profiles. No DDD=>municipality inference. Auth-less profiles with
--   no declared verified coverage cannot appear in #255's IBGE-only filter.
-- * Never auto-import/approve the 99 historical external captures.
-- * No grants on private provenance/contacts/blocked data, no phone exposure.
-- * Stage checks must prove function owner BYPASSRLS, PostgREST exposed
--   schemas, direct REST anon/auth behavior, owner/admin read preservation,
--   private column grants, and reversible deployment before any hosted SQL.
