-- ONLY FOR A BRAND-NEW DISPOSABLE POSTGRES INSTANCE IN GITHUB ACTIONS.
-- Never run against Supabase or any populated database.
DO $fixture_guard$
BEGIN
  IF current_database() <> 'eut_fixture' OR current_user <> 'eut_fixture'
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'auth')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'eut_moderation')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated'))
  THEN
    RAISE EXCEPTION 'Refusing SQL fixture outside a clean, disposable eut_fixture database';
  END IF;
END $fixture_guard$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA eut_moderation;
CREATE TYPE public.app_role AS ENUM ('admin','cliente','tecnico');
CREATE TYPE public.approval_status AS ENUM ('pendente','aprovado','suspenso','rejeitado');

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email_confirmed_at timestamptz
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid;
  $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL, PRIMARY KEY(user_id,role)
);
CREATE OR REPLACE FUNCTION public.has_role(_uid uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=_uid AND r.role=_role); $$;

CREATE TABLE public.eut_ibge_municipalities (id integer PRIMARY KEY,name text NOT NULL,uf text NOT NULL);
CREATE TABLE public.eut_service_categories (slug text PRIMARY KEY,active boolean NOT NULL);
CREATE TABLE public.eut_service_types (slug text PRIMARY KEY,category_slug text NOT NULL REFERENCES public.eut_service_categories(slug),active boolean NOT NULL);
-- WordPress migration provenance is a review source, not a login account.
CREATE TABLE public.legacy_review_profiles (
  source_key text NOT NULL,
  wp_post_id integer NOT NULL,
  kind text NOT NULL,
  demo_candidate boolean NOT NULL DEFAULT false,
  PRIMARY KEY(source_key,wp_post_id)
);
CREATE TABLE public.technicians (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  display_name text NOT NULL,
  city text NOT NULL,
  state_uf text,
  neighborhood text,
  specialties text[] NOT NULL DEFAULT '{}',
  service_slugs text[] NOT NULL DEFAULT '{}',
  coverage_city_ids integer[] NOT NULL DEFAULT '{}',
  service_radius_km integer,
  status public.approval_status NOT NULL DEFAULT 'pendente',
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT coverage_max_five CHECK (cardinality(coverage_city_ids)<=5),
  CONSTRAINT service_max_sixty_four CHECK (cardinality(service_slugs)<=64)
);
CREATE TABLE public.eut_technician_private_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'),
  allow_paid_contact boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE eut_moderation.blocked_accounts (user_id uuid PRIMARY KEY,reason_internal text NOT NULL);
CREATE TABLE eut_moderation.blocked_phones (phone_digits text PRIMARY KEY,reason_internal text NOT NULL);
CREATE TABLE public.eut_admin_management_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  target_type text NOT NULL,
  target_key text NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Simulate only the relevant existing production triggers, whose definitions
-- were inspected READ-ONLY; never substitute fixtures for staging validation.
CREATE OR REPLACE FUNCTION public.fixture_technician_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE canonical text; base_id integer;
BEGIN
  IF NEW.status='aprovado' THEN
    SELECT id,name INTO base_id,canonical FROM public.eut_ibge_municipalities
      WHERE lower(name)=lower(NEW.city) AND uf=NEW.state_uf LIMIT 1;
    IF base_id IS NULL THEN RAISE EXCEPTION 'Cidade IBGE não encontrada'; END IF;
    NEW.city:=canonical;
    IF TG_OP='UPDATE' AND (OLD.city IS DISTINCT FROM NEW.city OR
                           OLD.state_uf IS DISTINCT FROM NEW.state_uf) THEN
      NEW.coverage_city_ids:='{}'::integer[];
      NEW.service_radius_km:=NULL;
    END IF;
    IF cardinality(NEW.coverage_city_ids)>0 THEN
      IF base_id<>ALL(NEW.coverage_city_ids) THEN
        RAISE EXCEPTION 'Cidade-base obrigatória'; END IF;
      IF (SELECT count(DISTINCT id) FROM public.eut_ibge_municipalities
         WHERE id=ANY(NEW.coverage_city_ids))<>cardinality(NEW.coverage_city_ids) THEN
        RAISE EXCEPTION 'Cidades inválidas'; END IF;
    END IF;
  ELSIF cardinality(NEW.coverage_city_ids)>0 THEN
    RAISE EXCEPTION 'Cobertura só para aprovados';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fixture_guard
  BEFORE INSERT OR UPDATE OF city,state_uf,status,coverage_city_ids ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.fixture_technician_guard();

CREATE OR REPLACE FUNCTION public.fixture_tech_services_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.service_slugs) x
    LEFT JOIN public.eut_service_types s ON s.slug=x AND s.active
    LEFT JOIN public.eut_service_categories c ON c.slug=s.category_slug AND c.active
    WHERE s.slug IS NULL OR c.slug IS NULL OR NOT s.category_slug=ANY(NEW.specialties)) THEN
    RAISE EXCEPTION 'Serviços inválidos'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fixture_services BEFORE INSERT OR UPDATE OF specialties,service_slugs
ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.fixture_tech_services_guard();

CREATE OR REPLACE FUNCTION public.fixture_phone_ban_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=NEW.user_id)
    OR EXISTS (SELECT 1 FROM eut_moderation.blocked_phones b
      WHERE b.phone_digits=regexp_replace(NEW.phone_e164,'[^0-9]','','g')) THEN
    IF TG_OP='UPDATE' AND NEW.phone_e164 IS NOT DISTINCT FROM OLD.phone_e164
      AND NEW.allow_paid_contact=false THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Bloqueio de conta/telefone' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fixture_phone_restrict
BEFORE INSERT OR UPDATE OF phone_e164,allow_paid_contact ON public.eut_technician_private_contacts
FOR EACH ROW EXECUTE FUNCTION public.fixture_phone_ban_guard();

CREATE OR REPLACE FUNCTION public.fixture_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER fixture_updated BEFORE UPDATE ON public.technicians
FOR EACH ROW EXECUTE FUNCTION public.fixture_updated_at();

-- Synthetic users; none of these UUIDs represent portal accounts.
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000000001',now()), -- verified admin
 ('00000000-0000-4000-8000-000000000002',now()), -- client
 ('00000000-0000-4000-8000-000000000003',now()), -- technician A
 ('00000000-0000-4000-8000-000000000004',now()), -- technician B
 ('00000000-0000-4000-8000-000000000005',NULL);  -- unverified admin
INSERT INTO public.user_roles VALUES
 ('00000000-0000-4000-8000-000000000001','admin'),
 ('00000000-0000-4000-8000-000000000002','cliente'),
 ('00000000-0000-4000-8000-000000000003','tecnico'),
 ('00000000-0000-4000-8000-000000000004','tecnico'),
 ('00000000-0000-4000-8000-000000000005','admin');
INSERT INTO public.eut_ibge_municipalities VALUES
 (4125506,'São José dos Pinhais','PR'),
 (4106902,'Curitiba','PR'),
 (1200203,'Cruzeiro do Sul','AC');
INSERT INTO public.eut_service_categories VALUES
 ('computadores',true),('redes',true),('desativada',false);
INSERT INTO public.eut_service_types VALUES
 ('manutencao-pc','computadores',true),
 ('wifi','redes',true),
 ('inativo','computadores',false);
INSERT INTO public.legacy_review_profiles VALUES
 ('wordpress_20261108',1001,'candidate',false),
 ('wordpress_20261108',1002,'candidate',true),
 ('wordpress_20261108',1003,'employer',false);
INSERT INTO public.technicians(id,user_id,display_name,city,state_uf,specialties,
 service_slugs,coverage_city_ids,service_radius_km,status) VALUES
 ('10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003','Técnico QA A',
  'São José dos Pinhais','PR',ARRAY['computadores'],ARRAY['manutencao-pc'],
  ARRAY[4125506],20,'aprovado'),
 ('10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000004','Técnico QA B',
  'Curitiba','PR',ARRAY['computadores'],ARRAY['manutencao-pc'],
  ARRAY[4106902],10,'aprovado');
INSERT INTO public.eut_technician_private_contacts(user_id,phone_e164,allow_paid_contact)
VALUES
 ('00000000-0000-4000-8000-000000000003','+5541999990001',true),
 ('00000000-0000-4000-8000-000000000004','+5541999990002',true);

REVOKE ALL ON ALL TABLES IN SCHEMA public,eut_moderation,auth FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated;
