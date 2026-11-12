-- PostgreSQL 16 disposable container fixture ONLY. Never use in hosted Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;

CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TYPE public.app_role AS ENUM('admin','tecnico','cliente');
CREATE TABLE public.user_roles(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role public.app_role NOT NULL,
 PRIMARY KEY(user_id,role)
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path='pg_catalog'
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
CREATE FUNCTION public.has_role(_uid uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog'
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role=_role); $$;

GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,anon;

INSERT INTO auth.users VALUES
 ('00000000-0000-4000-8000-000000000011'),
 ('00000000-0000-4000-8000-000000000012'),
 ('00000000-0000-4000-8000-000000000013');
INSERT INTO public.user_roles VALUES
 ('00000000-0000-4000-8000-000000000011','tecnico'),
 ('00000000-0000-4000-8000-000000000012','tecnico'),
 ('00000000-0000-4000-8000-000000000013','cliente');
