-- Fixture descartável de CI; NUNCA executar no Supabase oficial.
-- As migrações normais da aplicação já fornecem public.user_roles/has_role.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA eut_migration;
CREATE SCHEMA eut_moderation;
REVOKE ALL ON SCHEMA eut_migration, eut_moderation FROM PUBLIC, anon, authenticated;

CREATE TABLE eut_migration.project_owner_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton=true),
  owner_email text NOT NULL,
  claimed_user_id uuid REFERENCES auth.users(id),
  claimed_at timestamptz
);
ALTER TABLE eut_migration.project_owner_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.project_owner_bootstrap FROM PUBLIC, anon, authenticated;

CREATE TABLE eut_moderation.blocked_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE eut_moderation.blocked_phones (phone_digits text PRIMARY KEY);
CREATE TABLE public.eut_technician_private_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 text
);
ALTER TABLE eut_moderation.blocked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_technician_private_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.blocked_accounts,
  eut_moderation.blocked_phones, public.eut_technician_private_contacts
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM eut_moderation.blocked_accounts b
                    WHERE b.user_id=auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE c.user_id=auth.uid()
    );
$function$;
REVOKE ALL ON FUNCTION public.eut_account_operational() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eut_account_operational() TO authenticated;
COMMIT;
