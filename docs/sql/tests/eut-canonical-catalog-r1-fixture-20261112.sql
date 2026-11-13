-- Disposable PostgreSQL only, after the established synthetic admin fixture.
CREATE OR REPLACE FUNCTION public.eut_account_operational() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog' AS $$
 SELECT auth.uid() IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=auth.uid());
$$;

-- Two existing, real-schema-shaped synthetic technicians represent historic bans.
INSERT INTO eut_moderation.blocked_accounts(user_id,reason_internal) VALUES
 ('00000000-0000-4000-8000-000000000003','Bloqueio QA legado');
UPDATE public.technicians SET status='suspenso',
  coverage_city_ids='{}'::integer[],service_radius_km=NULL
WHERE user_id='00000000-0000-4000-8000-000000000004';
