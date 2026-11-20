-- EXCLUSIVAMENTE POSTGRESQL DESCARTÁVEL; sem dados reais.
CREATE SCHEMA auth;
CREATE SCHEMA eut_migration;
CREATE SCHEMA eut_moderation;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','cliente','tecnico');
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL,email_confirmed_at timestamptz);
CREATE TABLE auth.identities(
 user_id uuid NOT NULL REFERENCES auth.users(id),provider text NOT NULL,
 identity_data jsonb NOT NULL,PRIMARY KEY(user_id,provider));
CREATE TABLE auth.sessions(
 id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),not_after timestamptz);
CREATE TABLE public.user_roles(
 user_id uuid REFERENCES auth.users(id),role public.app_role NOT NULL,PRIMARY KEY(user_id,role));
CREATE TABLE eut_migration.project_owner_bootstrap(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 owner_email text NOT NULL CHECK(owner_email=lower(btrim(owner_email)) AND owner_email LIKE '%@%'),
 claimed_user_id uuid REFERENCES auth.users(id),claimed_at timestamptz,
 CHECK((claimed_user_id IS NULL)=(claimed_at IS NULL)));
CREATE TABLE eut_moderation.blocked_accounts(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE TABLE eut_moderation.blocked_phones(phone_digits text PRIMARY KEY);
CREATE TABLE public.eut_technician_private_contacts(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),phone_e164 text);
CREATE TABLE public.mp_protected_sentinels(id int PRIMARY KEY,label text NOT NULL);
INSERT INTO public.mp_protected_sentinels VALUES
 (1,'SUSPENSO_INTOCAVEL'),(2,'PIONEIRO_INTOCAVEL'),(3,'CONTATO_PRIVADO_INTOCAVEL');
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_migration.project_owner_bootstrap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_technician_private_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles,eut_migration.project_owner_bootstrap,
 public.eut_technician_private_contacts FROM PUBLIC,anon,authenticated;
INSERT INTO auth.users VALUES
 ('10000000-0000-4000-8000-000000000001','owner@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','other@example.invalid',now());
INSERT INTO auth.identities VALUES
 ('10000000-0000-4000-8000-000000000001','google',
 '{"email":"owner@example.invalid","email_verified":"true"}'),
 ('10000000-0000-4000-8000-000000000002','google',
 '{"email":"other@example.invalid","email_verified":"true"}');
INSERT INTO auth.sessions VALUES
 ('20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001',now()+interval '1 day');
INSERT INTO public.user_roles VALUES('10000000-0000-4000-8000-000000000001','admin');
INSERT INTO eut_migration.project_owner_bootstrap(singleton,owner_email)
 VALUES(true,'owner@example.invalid');
INSERT INTO public.eut_technician_private_contacts VALUES
 ('10000000-0000-4000-8000-000000000001','synthetic-not-a-phone');
