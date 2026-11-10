-- One-time project owner bootstrap. The authorized email is configured
-- ONLY in the private Supabase table via a separate operator action.
-- This migration deliberately contains no personal email address.
CREATE TABLE IF NOT EXISTS eut_migration.project_owner_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  owner_email text NOT NULL CHECK (
    owner_email = lower(btrim(owner_email)) AND owner_email LIKE '%@%'
  ),
  claimed_user_id uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((claimed_user_id IS NULL) = (claimed_at IS NULL))
);
ALTER TABLE eut_migration.project_owner_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.project_owner_bootstrap FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eut_can_bootstrap_project_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM eut_migration.project_owner_bootstrap b
    JOIN auth.users u ON u.id = auth.uid()
      AND lower(btrim(u.email)) = b.owner_email
      AND u.email_confirmed_at IS NOT NULL
    JOIN auth.identities i ON i.user_id = u.id
      AND i.provider = 'google'
      AND lower(coalesce(i.identity_data->>'email', '')) = b.owner_email
      AND i.identity_data->>'email_verified' = 'true'
    WHERE b.singleton = true
      AND b.claimed_user_id IS NULL
      AND b.claimed_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.role = 'admin'::public.app_role
  );
$$;
REVOKE ALL ON FUNCTION public.eut_can_bootstrap_project_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_can_bootstrap_project_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.eut_bootstrap_project_owner()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner_email text;
  v_rows integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'verified Google project owner required';
  END IF;

  -- One claim for this project, serialized and independently verified.
  PERFORM pg_advisory_xact_lock(hashtextextended('eut:project-owner:bootstrap', 0));

  SELECT owner_email INTO v_owner_email
  FROM eut_migration.project_owner_bootstrap
  WHERE singleton = true AND claimed_user_id IS NULL AND claimed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project owner bootstrap unavailable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'administrator already configured';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN auth.identities i ON i.user_id=u.id
    WHERE u.id=v_user AND u.email_confirmed_at IS NOT NULL
      AND lower(btrim(u.email))=v_owner_email
      AND i.provider='google'
      AND lower(coalesce(i.identity_data->>'email',''))=v_owner_email
      AND i.identity_data->>'email_verified'='true'
  ) THEN
    RAISE EXCEPTION 'verified Google project owner required';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user, 'admin'::public.app_role)
  ON CONFLICT (user_id,role) DO NOTHING;

  UPDATE eut_migration.project_owner_bootstrap
  SET claimed_user_id=v_user, claimed_at=now()
  WHERE singleton=true AND claimed_user_id IS NULL AND claimed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'owner bootstrap concurrency conflict';
  END IF;

  RETURN 'admin_ativado';
END;
$$;
REVOKE ALL ON FUNCTION public.eut_bootstrap_project_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_bootstrap_project_owner() TO authenticated;
