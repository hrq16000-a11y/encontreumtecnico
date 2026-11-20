-- Synthetic, disposable Auth/profile/contact fixture. NEVER run in Supabase.
CREATE TYPE public.approval_status AS ENUM ('aprovado','pendente','rejeitado');

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL,
  PRIMARY KEY(user_id,role)
);
CREATE TABLE public.technicians (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status public.approval_status NOT NULL
);
CREATE TABLE public.eut_technician_private_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  allow_paid_contact boolean NOT NULL DEFAULT false,
  phone_e164 text
);
CREATE TABLE public.eut_contact_entitlements (
  client_id uuid NOT NULL REFERENCES auth.users(id),
  technician_id uuid NOT NULL REFERENCES public.technicians(id),
  access_date date NOT NULL,
  PRIMARY KEY(client_id,technician_id,access_date)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_technician_private_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_contact_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles,public.technicians,
  public.eut_technician_private_contacts,public.eut_contact_entitlements
  FROM PUBLIC,anon,authenticated;

CREATE FUNCTION eut_migration.confirmed_current_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
  SELECT u.email FROM auth.users u
  WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION eut_migration.confirmed_current_email() FROM PUBLIC,anon;

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('10000000-0000-4000-8000-000000000004','tech-a@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000005','tech-b@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000006','client-b@example.invalid',now());
INSERT INTO auth.sessions(id,user_id,not_after) VALUES
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006',now()+interval '1 day');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('10000000-0000-4000-8000-000000000003','cliente'),
 ('10000000-0000-4000-8000-000000000006','cliente');
INSERT INTO public.technicians(id,user_id,status) VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','aprovado'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','aprovado');
INSERT INTO public.eut_technician_private_contacts(user_id,allow_paid_contact,phone_e164)
VALUES
 ('10000000-0000-4000-8000-000000000004',true,'synthetic-only-a'),
 ('10000000-0000-4000-8000-000000000005',true,'synthetic-only-b');
