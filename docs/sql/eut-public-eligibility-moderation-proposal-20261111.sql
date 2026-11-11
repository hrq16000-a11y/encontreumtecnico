-- Encontre um Técnico: proposed public eligibility gate.
-- STAGING DESIGN ONLY. DO NOT RUN against production. No migration has been applied.
-- Prerequisites: confirm schema, privileges, RLS and function ownership in isolated staging.
-- Intended semantics: approved technician AND owner not banned AND phone not blocked.
-- No private contact/ban list rows or ban reason are returned to anon callers.

BEGIN;

-- SECURITY DEFINER is necessary ONLY to check the private moderation/contact tables.
-- Explicit schemas and search_path prevent untrusted function resolution.
CREATE OR REPLACE FUNCTION public.eut_public_technician_eligible(_technician_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.technicians AS t
    WHERE t.id = _technician_id
      AND t.status = 'aprovado'::public.approval_status
      AND t.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM eut_moderation.blocked_accounts AS banned
        WHERE banned.user_id = t.user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.eut_technician_private_contacts AS contact
        JOIN eut_moderation.blocked_phones AS blocked
          ON blocked.phone_digits =
            pg_catalog.regexp_replace(pg_catalog.coalesce(contact.phone_e164, ''), '[^0-9]', '', 'g')
        WHERE contact.user_id = t.user_id
          AND contact.phone_e164 IS NOT NULL
          AND pg_catalog.regexp_replace(contact.phone_e164, '[^0-9]', '', 'g') <> ''
      )
  );
$$;

REVOKE ALL ON FUNCTION public.eut_public_technician_eligible(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_technician_eligible(uuid)
  TO anon, authenticated;

-- Returns ONLY the IDs that are safe to show. Does not return membership
-- in any blacklist, phone, user_id, email, status, or reason.
CREATE OR REPLACE FUNCTION public.eut_public_eligible_technician_ids(_ids uuid[])
RETURNS TABLE (technician_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'pg_catalog'
AS $$
  SELECT t.id
  FROM public.technicians AS t
  WHERE _ids IS NOT NULL
    AND pg_catalog.cardinality(_ids) BETWEEN 1 AND 500
    AND t.id = ANY(_ids)
    AND public.eut_public_technician_eligible(t.id)
  GROUP BY t.id
  ORDER BY t.id;
$$;

REVOKE ALL ON FUNCTION public.eut_public_eligible_technician_ids(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_eligible_technician_ids(uuid[])
  TO anon, authenticated;

-- Keep other SELECT policies ("Admin reads all", "Owner reads own") intact.
-- Amend only the existing public-read policy so direct REST reads cannot bypass
-- the new server-side eligibility gate. Owner/admin reads are not altered.
DROP POLICY IF EXISTS "Public reads approved" ON public.technicians;
CREATE POLICY "Public reads approved" ON public.technicians
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (
    status = 'aprovado'::public.approval_status
    AND public.eut_public_technician_eligible(id)
  );

COMMIT;

-- ACTIVATION REQUIRES BEFORE/AFTER RLS TESTS IN STAGING:
-- 1. anon SELECT for approved, suspended, banned UUID, banned phone;
-- 2. direct PostgREST SELECT by slug/ID; check no private fields;
-- 3. batch RPC anonymous and authenticated: returns only technician_id;
-- 4. owner/admin policies retained; no bypass of restricted operational actions;
-- 5. ban + reapprove remains excluded (status alone cannot override the gate);
-- 6. test rollback and indexes on private_contacts.user_id, blocked_phones.phone_digits;
-- 7. review execution definer owner, permission grants and query plan.
