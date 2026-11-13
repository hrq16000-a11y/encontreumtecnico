-- ADDITIVE SYNTHETIC FIXTURES. Only run after ephemeral schema in GitHub Actions.
-- This file is intentionally incompatible with hosted Supabase: local-only fake Auth.
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id));
INSERT INTO public.profiles(id)
SELECT u.id FROM auth.users u;
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000000006',now()), -- confirmed technician without profile row
 ('00000000-0000-4000-8000-000000000007',now()), -- banned technician
 ('00000000-0000-4000-8000-000000000008',NULL),  -- unconfirmed technician
 ('00000000-0000-4000-8000-000000000009',now()); -- audit rollback candidate
INSERT INTO public.profiles(id)
 SELECT id FROM auth.users WHERE id IN (
 '00000000-0000-4000-8000-000000000006',
 '00000000-0000-4000-8000-000000000007',
 '00000000-0000-4000-8000-000000000008',
 '00000000-0000-4000-8000-000000000009');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000006','tecnico'),
 ('00000000-0000-4000-8000-000000000007','tecnico'),
 ('00000000-0000-4000-8000-000000000008','tecnico'),
 ('00000000-0000-4000-8000-000000000009','tecnico');
INSERT INTO eut_moderation.blocked_accounts(user_id,reason_internal)
 VALUES('00000000-0000-4000-8000-000000000007','Bloqueio sintético');
CREATE OR REPLACE FUNCTION public.eut_account_operational() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=auth.uid());
$$;
