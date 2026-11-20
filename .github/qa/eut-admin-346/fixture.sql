-- Isolated functional fixture for the exact pre-existing EUT moderation RPC.
-- No real identities, phone columns, contacts or production credentials.
BEGIN;
CREATE SCHEMA IF NOT EXISTS eut_moderation;
CREATE TYPE public.app_role AS ENUM ('admin', 'technician', 'user');
CREATE TYPE public.approval_status AS ENUM ('pendente', 'aprovado', 'suspenso', 'rejeitado');

CREATE TABLE public.eut_qa_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  role public.app_role NOT NULL
);
ALTER TABLE public.eut_qa_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_qa_roles FROM PUBLIC, anon, authenticated;

-- The real RPC calls has_role against a server-owned role table, never JWT user_metadata.
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.eut_qa_roles r
    WHERE r.user_id = _user_id AND r.role = _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT USAGE ON TYPE public.app_role, public.approval_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE public.technicians (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status public.approval_status NOT NULL DEFAULT 'pendente',
  display_name text NOT NULL,
  bio text,
  region text,
  reviewed_at timestamptz
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technicians FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.technicians TO authenticated;
GRANT SELECT, INSERT ON public.technicians TO service_role;
CREATE POLICY eut_qa_admin_select ON public.technicians FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY eut_qa_admin_update ON public.technicians FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
COMMIT;
