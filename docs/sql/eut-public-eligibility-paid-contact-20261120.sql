-- EUT: narrow public eligibility correction for portal technicians.
-- Run only in the dedicated EUT project after reviewing the linked PR/checks.
-- Function-only replacement: no contact, account, registry, RLS, or policy writes.
-- Its original blocking behavior for suspended accounts/phones is preserved.
-- Expected at preflight (2026-11-20): 7 approved; 4 with consented phones.
-- Rollback: eut-public-eligibility-paid-contact-rollback-20261120.sql.
BEGIN;

DO $preflight$
DECLARE v_function pg_proc%ROWTYPE;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Expected the existing postgres function owner';
  END IF;
  SELECT p.* INTO v_function FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='eut_visibility' AND p.proname='eut_public_technician_eligible'
    AND pg_get_function_identity_arguments(p.oid)='_technician_id uuid';
  IF NOT FOUND OR NOT v_function.prosecdef OR
     md5(v_function.prosrc)<>'d3393775f617091d17658facad4d84ab' THEN
    RAISE EXCEPTION 'Eligibility definition drifted: review before applying';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename='technicians' AND policyname IN
      ('eut_public_visibility_anon_guard','eut_public_visibility_auth_guard'))<>2 THEN
    RAISE EXCEPTION 'Visibility policy baseline changed';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible(
  _technician_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.technicians t
  WHERE t.id=_technician_id
  AND t.status='aprovado'::public.approval_status
  AND t.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.eut_technician_private_contacts c
    WHERE c.user_id=t.user_id
      AND c.allow_paid_contact IS TRUE
      AND c.phone_e164 ~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'
  )
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

DO $postcheck$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.technicians t
    WHERE eut_visibility.eut_public_technician_eligible(t.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.eut_technician_private_contacts c
        WHERE c.user_id=t.user_id AND c.allow_paid_contact IS TRUE
          AND c.phone_e164 ~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'
      )
  ) THEN
    RAISE EXCEPTION 'Unsafe public profile remains eligible';
  END IF;
  IF (SELECT pg_get_userbyid(p.proowner) FROM pg_proc p
      WHERE p.oid='eut_visibility.eut_public_technician_eligible(uuid)'::regprocedure)<>'postgres' THEN
    RAISE EXCEPTION 'Eligibility function owner changed';
  END IF;
END;
$postcheck$;
COMMIT;
