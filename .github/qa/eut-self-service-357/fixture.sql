-- Exclusivamente Supabase LOCAL: todas as identidades, fichas e telefones sao sinteticos.
-- Estrutura minima necessaria para executar as OITO RPCs capturadas sem edicoes.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA IF NOT EXISTS eut_migration;
CREATE SCHEMA IF NOT EXISTS eut_moderation;
REVOKE ALL ON SCHEMA eut_migration, eut_moderation FROM PUBLIC, anon, authenticated;

CREATE TYPE public.app_role AS ENUM ('admin','tecnico','cliente');
CREATE TYPE public.approval_status AS ENUM ('pendente','aprovado','suspenso','rejeitado');
GRANT USAGE ON TYPE public.app_role, public.approval_status TO authenticated;

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  PRIMARY KEY (user_id,role)
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text
);
CREATE TABLE public.eut_service_categories (slug text PRIMARY KEY, active boolean NOT NULL);
CREATE TABLE public.eut_service_types (
  slug text PRIMARY KEY, category_slug text NOT NULL REFERENCES public.eut_service_categories(slug),
  active boolean NOT NULL
);
INSERT INTO public.eut_service_categories VALUES ('informatica',true),('eletrica',true);
INSERT INTO public.eut_service_types VALUES ('formatacao','informatica',true),('instalacao','eletrica',true);

CREATE TABLE public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL, city text NOT NULL, state_uf text,
  neighborhood text, region text, bio text,
  specialties text[] NOT NULL DEFAULT '{}', service_slugs text[] NOT NULL DEFAULT '{}',
  status public.approval_status NOT NULL DEFAULT 'pendente',
  avatar_path text,
  coverage_city_ids integer[] NOT NULL DEFAULT '{}',
  service_radius_km integer,
  reviewed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.eut_technician_private_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 text, allow_paid_contact boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.eut_technician_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available boolean NOT NULL, last_seen_at timestamptz, updated_at timestamptz NOT NULL
);
CREATE TABLE public.eut_admin_management_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id), target_type text NOT NULL,
  target_key text NOT NULL, action text NOT NULL, reason text NOT NULL,
  before_state jsonb, after_state jsonb,
  CONSTRAINT safe_target CHECK (target_type IN ('technician','account','legacy_review'))
);
-- Historico de negocio que obrigatoriamente permanece apos remover a ficha.
CREATE TABLE public.eut_qa_historical_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE RESTRICT,
  description text NOT NULL
);
CREATE TABLE eut_moderation.blocked_accounts (user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE eut_moderation.blocked_phones (phone_digits text PRIMARY KEY);

CREATE OR REPLACE FUNCTION public.has_role(p_uid uuid, p_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog'
AS $function$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id=p_uid AND r.role=p_role
); $function$;
CREATE OR REPLACE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog'
AS $function$
 SELECT auth.uid() IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=auth.uid())
  AND NOT EXISTS(SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE c.user_id=auth.uid());
$function$;
-- Simula deliberadamente uma sessao SEM a prova adicional; antes do patch
-- a propria RPC de publicacao deve recusar, mesmo com o usuario logado.
CREATE OR REPLACE FUNCTION eut_migration.confirmed_current_email()
RETURNS text LANGUAGE sql STABLE SET search_path='pg_catalog'
AS $function$ SELECT NULL::text; $function$;

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_technician_private_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_admin_management_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_qa_historical_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_technician_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_phones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technicians, public.user_roles,
  public.eut_technician_private_contacts, public.eut_admin_management_log,
  public.eut_qa_historical_request, public.eut_technician_presence
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.technicians TO authenticated;
CREATE POLICY self_select ON public.technicians FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON FUNCTION public.eut_account_operational() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eut_account_operational() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated;
COMMIT;
