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
CREATE FUNCTION public.has_role(_id uuid,_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT _id = auth.uid() AND _role::text = current_setting('eut.fixture.role',true);
$$;
CREATE POLICY admin_read_log ON public.eut_admin_management_log FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin'::public.app_role));
GRANT SELECT ON public.eut_admin_management_log TO authenticated;
CREATE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT current_setting('eut.fixture.blocked',true) IS DISTINCT FROM 'true';
$$;
CREATE FUNCTION public.eut_public_eligible_technician_ids(_ids uuid[])
RETURNS TABLE(technician_id uuid) LANGUAGE sql STABLE AS $$
 SELECT id FROM public.technicians
 WHERE id = ANY(_ids) AND status='aprovado' AND NOT fixture_blocked;
$$;
INSERT INTO public.technicians(id,user_id,status,coverage_city_ids,fixture_blocked) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','aprovado',ARRAY[4106902,4125506],false),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','suspenso',ARRAY[4106902],true),
 ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','suspenso',ARRAY[4106902],true);
