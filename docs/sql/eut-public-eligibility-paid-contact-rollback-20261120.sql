-- Emergency rollback ONLY for the corresponding function-only release.
-- Restores the exact prior public eligibility behavior; no tables/policies/RLS touched.
-- Re-verify current source before running: rollback can re-expose profiles
-- without private phones, so prefer to fix forward if the policy is intentional.
BEGIN;

DO $preflight$
BEGIN
  IF current_user<>'postgres' OR NOT EXISTS(
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='eut_visibility' AND p.proname='eut_public_technician_eligible'
      AND pg_get_function_identity_arguments(p.oid)='_technician_id uuid'
      AND p.prosrc LIKE '%c.allow_paid_contact IS TRUE%'
      AND p.prosrc LIKE '%c.phone_e164 ~%'
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Rollback target changed; stop and review';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible(_technician_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.technicians t
  WHERE t.id=_technician_id
  AND t.status='aprovado'::public.approval_status
  AND t.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=t.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.eut_technician_private_contacts c
    JOIN eut_moderation.blocked_phones b
      ON b.phone_digits=pg_catalog.regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
    WHERE c.user_id=t.user_id AND c.phone_e164 IS NOT NULL
      AND pg_catalog.regexp_replace(c.phone_e164,'[^0-9]','','g')<>''
  )
 );
$function$;
COMMIT;
