-- SOMENTE Supabase local descartavel. Nao contem dados, contatos ou credenciais reais.
BEGIN;
CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico', 'cliente');
CREATE TYPE public.approval_status AS ENUM ('pendente', 'aprovado', 'suspenso', 'rejeitado');

CREATE TABLE public.eut_ops_qa_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  role public.app_role NOT NULL
);
ALTER TABLE public.eut_ops_qa_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_ops_qa_roles FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.has_role(_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.eut_ops_qa_roles r
    WHERE r.user_id = _id AND r.role = _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE public.eut_ops_qa_blocked (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
ALTER TABLE public.eut_ops_qa_blocked ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_ops_qa_blocked FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.eut_ops_qa_blocked b WHERE b.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.eut_account_operational() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eut_account_operational() TO authenticated;

CREATE TABLE public.technicians (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status public.approval_status NOT NULL,
  coverage_city_ids integer[] NOT NULL DEFAULT '{}'::integer[],
  fixture_blocked boolean NOT NULL DEFAULT false
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technicians FROM PUBLIC, anon, authenticated;

-- Substituto local fechado da elegibilidade: prova a negacao dos suspensos,
-- mas nao substitui o gate de telefone/consentimento do projeto oficial.
CREATE FUNCTION public.eut_public_eligible_technician_ids(_ids uuid[])
RETURNS TABLE(technician_id uuid) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT t.id FROM public.technicians t
  WHERE t.id = ANY(_ids) AND t.status = 'aprovado'::public.approval_status
    AND NOT t.fixture_blocked;
$$;
REVOKE ALL ON FUNCTION public.eut_public_eligible_technician_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eut_public_eligible_technician_ids(uuid[]) TO anon, authenticated;

CREATE TABLE public.eut_admin_management_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  target_type text NOT NULL,
  target_key text NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL
);
ALTER TABLE public.eut_admin_management_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_admin_management_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eut_admin_management_log TO authenticated;
CREATE POLICY only_admin_reads_audit ON public.eut_admin_management_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
COMMIT;
