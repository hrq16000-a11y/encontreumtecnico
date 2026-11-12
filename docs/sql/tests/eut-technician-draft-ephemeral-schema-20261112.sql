-- PostgreSQL 17 disposable container fixture ONLY. Never use in hosted Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA eut_moderation;
REVOKE ALL ON SCHEMA eut_moderation FROM PUBLIC,anon,authenticated;

CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TYPE public.app_role AS ENUM('admin','tecnico','cliente');
-- Mirrors the read-only observed dedicated Supabase schema and RLS.
CREATE TABLE public.user_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path='pg_catalog'
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
CREATE FUNCTION public.has_role(_uid uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public'
AS $ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role=_role); $;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT
 USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'::public.app_role));

GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,anon;

INSERT INTO auth.users VALUES
 ('00000000-0000-4000-8000-000000000011'),
 ('00000000-0000-4000-8000-000000000012'),
 ('00000000-0000-4000-8000-000000000013');
INSERT INTO public.user_roles (user_id, role) VALUES
 ('00000000-0000-4000-8000-000000000011','tecnico'),
 ('00000000-0000-4000-8000-000000000012','tecnico'),
 ('00000000-0000-4000-8000-000000000013','cliente');
