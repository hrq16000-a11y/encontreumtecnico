-- Dados sintéticos SOMENTE para PostgreSQL descartável em CI; nunca em produção.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','tecnico','cliente');
CREATE TYPE public.approval_status AS ENUM ('pendente','aprovado','rejeitado','suspenso');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE TABLE public.technicians (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, status public.approval_status NOT NULL,
 coverage_city_ids integer[] NOT NULL DEFAULT '{}', fixture_blocked boolean NOT NULL DEFAULT false);
CREATE TABLE public.eut_admin_management_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid NOT NULL,
 target_type text NOT NULL, target_key text NOT NULL, action text NOT NULL,
 reason text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL);
ALTER TABLE public.eut_admin_management_log ENABLE ROW LEVEL SECURITY;
-- Estas relações representam autorização do SERVIDOR, não claims editáveis.
CREATE TABLE public.eut_fixture_role_assignments (
 user_id uuid NOT NULL, role public.app_role NOT NULL, PRIMARY KEY(user_id,role));
CREATE TABLE public.eut_fixture_blocked_accounts (user_id uuid PRIMARY KEY);
ALTER TABLE public.eut_fixture_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_fixture_blocked_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_fixture_role_assignments,public.eut_fixture_blocked_accounts
 FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.has_role(_id uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT _id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.eut_fixture_role_assignments r
   WHERE r.user_id=_id AND r.role=_role);
$$;
CREATE POLICY admin_read_log ON public.eut_admin_management_log FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin'::public.app_role));
GRANT SELECT ON public.eut_admin_management_log TO authenticated;
CREATE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.eut_fixture_blocked_accounts b
   WHERE b.user_id=(SELECT auth.uid()));
$$;
CREATE FUNCTION public.eut_public_eligible_technician_ids(_ids uuid[])
RETURNS TABLE(technician_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id FROM public.technicians t
 WHERE t.id = ANY(_ids) AND t.status='aprovado' AND NOT t.fixture_blocked
 AND NOT EXISTS (SELECT 1 FROM public.eut_fixture_blocked_accounts b WHERE b.user_id=t.user_id);
$$;
INSERT INTO public.technicians(id,user_id,status,coverage_city_ids,fixture_blocked) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','aprovado',ARRAY[4106902,4125506],false),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','suspenso',ARRAY[4106902],true),
 ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','suspenso',ARRAY[4106902],true);
INSERT INTO public.eut_fixture_role_assignments(user_id,role) VALUES
 ('20000000-0000-4000-8000-000000000001','tecnico'),
 ('20000000-0000-4000-8000-000000000002','tecnico'),
 ('20000000-0000-4000-8000-000000000003','tecnico'),
 ('20000000-0000-4000-8000-000000000004','tecnico'),
 ('30000000-0000-4000-8000-000000000001','admin'),
 ('40000000-0000-4000-8000-000000000001','cliente');
INSERT INTO public.eut_fixture_blocked_accounts(user_id) VALUES
 ('20000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000003');
