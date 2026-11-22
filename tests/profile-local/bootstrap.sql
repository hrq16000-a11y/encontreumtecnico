-- Uso EXCLUSIVAMENTE no Supabase local descartável do workflow P0.
-- Complementa as 6 migrações públicas antigas; não representa o esquema
-- completo do ambiente oficial e nunca deve ser aplicado nele.
\set ON_ERROR_STOP on
BEGIN;

-- A função choose_account_type versionada consulta estas duas filas legadas.
CREATE TABLE eut_migration.legacy_accounts (
  source_key text NOT NULL,
  wp_user_id bigint NOT NULL,
  wp_email text NOT NULL,
  PRIMARY KEY (source_key, wp_user_id)
);
CREATE TABLE eut_migration.account_activation_queue (
  source_key text NOT NULL,
  wp_user_id bigint NOT NULL,
  intended_type text,
  linked_auth_user_id uuid,
  PRIMARY KEY (source_key, wp_user_id)
);
REVOKE ALL ON eut_migration.legacy_accounts,
  eut_migration.account_activation_queue FROM PUBLIC, anon, authenticated;

-- A tabela local antiga precede o contrato canônico de publicação.
ALTER TABLE public.technicians
  ADD COLUMN state_uf text,
  ADD COLUMN neighborhood text,
  ADD COLUMN service_slugs text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN public_slug text;

CREATE TABLE public.eut_service_categories (
  slug text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.eut_service_types (
  slug text PRIMARY KEY,
  category_slug text NOT NULL REFERENCES public.eut_service_categories(slug),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO public.eut_service_categories(slug,active)
VALUES ('informatica',true),('redes',true);
INSERT INTO public.eut_service_types(slug,category_slug,active)
VALUES ('formatacao','informatica',true),('wifi','redes',true);
GRANT SELECT ON public.eut_service_categories, public.eut_service_types
  TO authenticated;

COMMIT;
