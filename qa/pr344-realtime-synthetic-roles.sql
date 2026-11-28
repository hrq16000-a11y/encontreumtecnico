-- Executar somente no banco descartável criado pelo workflow PR #344.
-- Não há ligação com o Supabase oficial ou dados de titulares.
BEGIN;

CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico');

CREATE TABLE public.pr344_synthetic_roles (
  user_id uuid PRIMARY KEY,
  role public.app_role NOT NULL
);

ALTER TABLE public.pr344_synthetic_roles ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.pr344_synthetic_roles r
     WHERE r.user_id = _user_id AND r.role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT ALL ON public.pr344_synthetic_roles TO service_role;

COMMIT;
