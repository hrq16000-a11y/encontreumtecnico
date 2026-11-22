-- OPTIONAL, MANUAL OPERATIONS STEP — NOT DEPLOYED / NOT EXECUTED.
-- Prerequisites: review privacy legal basis, execute Phase 3 schema in a controlled
-- migration, validate RLS + service RPC deny/allow tests, and confirm pg_cron is enabled.
-- This file is NOT part of the automatic migrations directory.
-- Execute by the database owner *only after approval* and check cron.job.
-- At most 1,000 rows per table per daily invocation; monitor outstanding backlog.
SELECT cron.schedule(
  'eut-visitor-retention-daily',
  '17 3 * * *',
  $$SELECT public.eut_visitor_retention_purge(1000);$$
);
-- Monitoring query (read-only after install):
-- SELECT jobid, jobname, schedule, command, active FROM cron.job
-- WHERE jobname='eut-visitor-retention-daily';
-- To disable without touching visitor records:
-- SELECT cron.unschedule('eut-visitor-retention-daily');
