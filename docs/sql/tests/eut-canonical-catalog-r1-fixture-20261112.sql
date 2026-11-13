-- Disposable PostgreSQL only, after the established synthetic admin fixture.
CREATE OR REPLACE FUNCTION public.eut_account_operational() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog' AS $$
 SELECT auth.uid() IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=auth.uid());
$$;
