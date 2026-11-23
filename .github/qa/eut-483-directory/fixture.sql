\set ON_ERROR_STOP on
-- Synthetic fixture for the UNMODIFIED #377 SQL, in a disposable local Supabase only.
-- No remote URLs, identities, phones, service-role secrets or imported production data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS eut_migration;
REVOKE ALL ON SCHEMA eut_migration FROM PUBLIC, anon, authenticated;

CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico', 'cliente');
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT USAGE ON TYPE public.app_role TO authenticated;
CREATE POLICY local_483_self_roles ON public.user_roles
  FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE FUNCTION public.has_role(_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_id AND role=_role
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated;

CREATE TABLE public.qa_483_blocked_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
ALTER TABLE public.qa_483_blocked_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qa_483_blocked_accounts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
  SELECT auth.uid() IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.qa_483_blocked_accounts b WHERE b.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.eut_account_operational() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eut_account_operational() TO authenticated;

CREATE TABLE eut_migration.project_owner_bootstrap (
  singleton boolean PRIMARY KEY CHECK (singleton),
  owner_email text NOT NULL,
  claimed_user_id uuid REFERENCES auth.users(id),
  claimed_at timestamptz
);
ALTER TABLE eut_migration.project_owner_bootstrap ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_migration.project_owner_bootstrap FROM PUBLIC, anon, authenticated;

-- Public synthetic directory, without contacts. These are NOT real imported professionals.
CREATE TABLE public.technicians (
  id uuid PRIMARY KEY,
  public_slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  specialties text[] NOT NULL DEFAULT '{}',
  service_slugs text[] NOT NULL DEFAULT '{}',
  city text NOT NULL,
  state_uf text,
  neighborhood text,
  region text,
  bio text,
  avatar_path text,
  service_radius_km numeric,
  coverage_city_ids integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('aprovado','suspenso')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technicians FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.technicians TO anon, authenticated;
CREATE POLICY local_483_public_approved ON public.technicians FOR SELECT TO anon, authenticated
USING (status='aprovado');

CREATE TABLE public.eut_ibge_municipalities (id integer PRIMARY KEY, name text NOT NULL, uf text NOT NULL);
ALTER TABLE public.eut_ibge_municipalities ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.eut_ibge_municipalities TO anon, authenticated;
CREATE POLICY local_483_ibge_read ON public.eut_ibge_municipalities FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.eut_ibge_municipalities VALUES
  (4106902,'Curitiba','PR'),(4125506,'São José dos Pinhais','PR');

CREATE OR REPLACE FUNCTION public.eut_public_admin_technicians(
  _slug text DEFAULT NULL,_category text DEFAULT NULL,_service text DEFAULT NULL,
  _uf text DEFAULT NULL,_city text DEFAULT NULL,_region text DEFAULT NULL,
  _limit integer DEFAULT 200,_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'pg_catalog' AS $$
  SELECT '[]'::jsonb;
$$;
GRANT EXECUTE ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.eut_public_eligible_technician_ids(_ids uuid[])
RETURNS TABLE(technician_id uuid) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $$
  SELECT id FROM public.technicians WHERE id=ANY(_ids) AND status='aprovado';
$$;
REVOKE ALL ON FUNCTION public.eut_public_eligible_technician_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eut_public_eligible_technician_ids(uuid[]) TO anon, authenticated;

CREATE TABLE public.eut_pioneer_badges(technician_id uuid PRIMARY KEY);
ALTER TABLE public.eut_pioneer_badges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.eut_pioneer_badges TO anon, authenticated;
CREATE POLICY local_483_empty_pioneers ON public.eut_pioneer_badges FOR SELECT TO anon, authenticated USING (true);

CREATE FUNCTION public.eut_online_published_ids(_technician_ids uuid[])
RETURNS TABLE(technician_id uuid) LANGUAGE sql STABLE AS $$ SELECT NULL::uuid WHERE false; $$;
CREATE FUNCTION public.eut_public_referral_highlights(_technician_ids uuid[])
RETURNS TABLE(technician_id uuid) LANGUAGE sql STABLE AS $$ SELECT NULL::uuid WHERE false; $$;
GRANT EXECUTE ON FUNCTION public.eut_online_published_ids(uuid[]),
  public.eut_public_referral_highlights(uuid[]) TO anon, authenticated;

CREATE TABLE public.eut_service_categories (
  slug text PRIMARY KEY, label text NOT NULL, description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true, display_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.eut_service_types (
  slug text PRIMARY KEY, category_slug text NOT NULL,
  label text NOT NULL, active boolean NOT NULL DEFAULT true, display_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.eut_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_service_types ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.eut_service_categories, public.eut_service_types TO anon, authenticated;
CREATE POLICY local_483_categories ON public.eut_service_categories FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY local_483_services ON public.eut_service_types FOR SELECT TO anon, authenticated USING (active);
INSERT INTO public.eut_service_categories(slug,label,description,display_order)
 VALUES ('computadores','Computadores','Técnicos de informática.',1);
INSERT INTO public.eut_service_types(slug,category_slug,label,display_order)
 VALUES ('manutencao','computadores','Manutenção de computadores',1);

INSERT INTO public.technicians(id,public_slug,display_name,specialties,service_slugs,city,state_uf,region,bio,coverage_city_ids,status) VALUES
('a1111111-1111-4111-8111-111111111111','qa-tecnico-curitiba','Técnico Sintético Curitiba',
 ARRAY['computadores'],ARRAY['manutencao'], 'Curitiba','PR','Curitiba', 'Técnico sintético de QA, sem contatos reais.',ARRAY[4125506],'aprovado'),
('a2222222-2222-4222-8222-222222222222','qa-tecnico-sjp','Técnico Sintético São José',
 ARRAY['computadores'],ARRAY['manutencao'], 'São José dos Pinhais','PR','Grande Curitiba', 'Segundo técnico sintético de QA.',ARRAY[4106902],'aprovado');
COMMIT;
