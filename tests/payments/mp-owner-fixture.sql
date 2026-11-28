-- Isolated PostgreSQL fixture. NEVER run against a Supabase project.
-- All UUIDs, identities and emails are synthetic.
CREATE SCHEMA auth;
CREATE SCHEMA eut_migration;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','cliente','tecnico');

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  email_confirmed_at timestamptz
);
CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  not_after timestamptz
);
CREATE TABLE eut_migration.project_owner_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  owner_email text NOT NULL,
  claimed_user_id uuid REFERENCES auth.users(id)
);
CREATE TABLE public.fixture_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id,role)
);
CREATE TABLE public.fixture_operational (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  active boolean NOT NULL
);

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$
  SELECT nullif(auth.jwt()->>'sub','')::uuid;
$$;
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.fixture_roles r WHERE r.user_id=_user_id AND r.role=_role);
$$;
CREATE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.fixture_operational a WHERE a.user_id=auth.uid() AND a.active);
$$;

-- Only authentication helpers are granted. Private tables and their data are
-- intentionally not exposed, including the fixture's auth table contents.
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(),auth.uid() TO anon,authenticated;

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('10000000-0000-4000-8000-000000000001','owner@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','admin@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','client@example.invalid',now());
INSERT INTO auth.sessions(id,user_id,not_after) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now()+interval '1 day'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',now()+interval '1 day'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',now()+interval '1 day');
INSERT INTO public.fixture_roles(user_id,role) VALUES
 ('10000000-0000-4000-8000-000000000001','admin'),
 ('10000000-0000-4000-8000-000000000002','admin'),
 ('10000000-0000-4000-8000-000000000003','cliente');
INSERT INTO public.fixture_operational(user_id,active) VALUES
 ('10000000-0000-4000-8000-000000000001',true),
 ('10000000-0000-4000-8000-000000000002',true),
 ('10000000-0000-4000-8000-000000000003',true);
INSERT INTO eut_migration.project_owner_bootstrap(singleton,owner_email,claimed_user_id)
VALUES(true,'owner@example.invalid','10000000-0000-4000-8000-000000000001');
