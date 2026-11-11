-- STAGING REVIEW DRAFT ONLY — NOT EXECUTED. 
-- Public eligibility defense in depth, no real user/phone writes.
-- MUST validate actual grants, existing SELECT policies, function owner,
-- PostgREST exposed schemas, and RLS interaction before ANY deployment.
-- The restricted helper schema must NOT be included in Data API exposed schemas.
--
-- Administrative reads/ownership are deliberately left unchanged for now.
-- Public SSR, RPC and sitemap clients MUST use an anonymous publishable-key
-- client with no end-user session. A separate staging test is required to
-- check authenticated direct REST access and decide compatible guardrails.
--
-- Do not treat this file as an approved migration; apply separately only
-- after staging permission and schema review with a qualified DB owner.

BEGIN;

-- Do not expand usage privileges on existing eut_moderation tables/schema.
CREATE SCHEMA IF NOT EXISTS eut_visibility;
REVOKE ALL ON SCHEMA eut_visibility FROM PUBLIC;
GRANT USAGE ON SCHEMA eut_visibility TO anon, authenticated;

-- SECURITY DEFINER is kept outside the Data API-exposed public schema.
-- An owner that BYPASSES technicians RLS is mandatory to avoid recursion in
-- the RLS policy below. Verify exact ownership in staging before activation.
CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible(
  _technician_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.technicians AS t
    WHERE t.id = _technician_id
      AND t.status = 'aprovado'::public.approval_status
      AND t.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM eut_moderation.blocked_accounts AS banned
        WHERE banned.user_id = t.user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.eut_technician_private_contacts AS contact
        JOIN eut_moderation.blocked_phones AS blocked
          ON blocked.phone_digits =
            pg_catalog.regexp_replace(
              pg_catalog.coalesce(contact.phone_e164, ''),
              '[^0-9]', '', 'g'
            )
        WHERE contact.user_id = t.user_id
          AND contact.phone_e164 IS NOT NULL
          AND pg_catalog.regexp_replace(
            contact.phone_e164, '[^0-9]', '', 'g'
          ) <> ''
      )
  );
$$;

REVOKE ALL ON FUNCTION
  eut_visibility.eut_public_technician_eligible(uuid)
  FROM PUBLIC, anon, authenticated;
-- The helper is needed for anon RLS evaluation, but cannot be addressed
-- via PostgREST unless the eut_visibility schema is exposed (FORBIDDEN).
GRANT EXECUTE ON FUNCTION
  eut_visibility.eut_public_technician_eligible(uuid)
  TO anon, authenticated;

-- The sole exposed RPC runs as the CALLER, therefore it remains subject to
-- technicians RLS. It only returns IDs from explicitly requested candidates.
CREATE OR REPLACE FUNCTION public.eut_public_eligible_technician_ids(
  _ids uuid[]
)
RETURNS TABLE (technician_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = 'pg_catalog'
AS $$
  SELECT t.id AS technician_id
  FROM public.technicians AS t
  WHERE _ids IS NOT NULL
    AND pg_catalog.cardinality(_ids) BETWEEN 1 AND 500
    AND t.id = ANY(_ids)
    AND t.status = 'aprovado'::public.approval_status
    AND eut_visibility.eut_public_technician_eligible(t.id)
  GROUP BY t.id
  ORDER BY t.id;
$$;

REVOKE ALL ON FUNCTION
  public.eut_public_eligible_technician_ids(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.eut_public_eligible_technician_ids(uuid[])
  TO anon, authenticated;

-- RESTRICTIVE SELECT policy makes the veto non-bypassable for ANON even
-- when a permissive public read policy exists. It does not replace or drop
-- existing owner/admin policies and does NOT grant SELECT by itself.
-- This assumes a permissive public policy already allows approved rows.
CREATE POLICY eut_public_visibility_anon_guard
  ON public.technicians
  AS RESTRICTIVE FOR SELECT TO anon
  USING (
    status = 'aprovado'::public.approval_status
    AND eut_visibility.eut_public_technician_eligible(id)
  );

COMMIT;

-- PRE-ACTIVATION HARD BLOCKERS (do not waive):
-- A. Verify that eut_visibility is NOT exposed in PostgREST schemas.
-- B. Verify function owner has required private read privileges and BYPASSRLS
--    for technicians to prevent SELECT-policy recursion.
-- C. Verify anon and authenticated cannot SELECT blocked lists or contacts.
-- D. Verify anon direct REST, callable RPC, and owner/admin SELECT separately.
-- E. Verify no OTHER public RPC, SELECT policy or view leaks banned profiles.
-- F. Verify guard policy doesn't break admin or owner moderation.
-- G. Verify fake UUID/phone deny, unblock recovery, and SELECT 404 behavior.
-- H. Benchmark 1-500 IDs per RPC, query plan, and eventual 50k sitemap scale.
-- I. Confirm no prior eut_public_visibility_anon_guard exists: migration needs
--    an explicitly reviewed idempotence/upgrade plan before reapplication.
-- J. Confirm a final approved migration has an explicit rollback and clean
--    deployment order (DB-first with staging, app-second), never vice versa.
