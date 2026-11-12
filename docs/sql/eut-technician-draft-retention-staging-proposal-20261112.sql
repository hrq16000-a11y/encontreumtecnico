-- STAGING PROPOSAL ONLY. DO NOT RUN AGAINST PRODUCTION.
-- The real dedicated Supabase is PostgreSQL 17.11, and pg_cron is NOT installed.
-- Run this private invoker function from a separately approved privileged scheduler.
-- No job is scheduled, no extension is installed, and no live data is deleted here.
BEGIN;

CREATE OR REPLACE FUNCTION eut_moderation.eut_purge_expired_technician_drafts(
  _batch_size integer DEFAULT 500
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path='pg_catalog'
AS $body$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF _batch_size IS NULL OR _batch_size < 1 OR _batch_size > 1000 THEN
    RAISE EXCEPTION 'Invalid cleanup batch size' USING ERRCODE='22023';
  END IF;
  -- SKIP LOCKED avoids blocking a concurrent edit and keeps each run bounded.
  -- Expired rows cannot be renewed by the draft UPDATE trigger.
  WITH doomed AS (
    SELECT d.owner_id
    FROM public.eut_technician_drafts d
    WHERE d.expires_at <= clock_timestamp()
    ORDER BY d.expires_at, d.owner_id
    LIMIT _batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.eut_technician_drafts d
  USING doomed
  WHERE d.owner_id = doomed.owner_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$body$;

-- Keep this out of the Data API. Do not grant usage on eut_moderation to app roles.
REVOKE ALL ON FUNCTION eut_moderation.eut_purge_expired_technician_drafts(integer)
  FROM PUBLIC, anon, authenticated;

-- Prerequisite, provisioned OUT OF BAND by the database administrator:
-- dedicated role eut_draft_maint with a secret stored only in a protected
-- GitHub Actions environment. No credential or CREATE ROLE in this file.
-- Fail closed until such a role is provisioned.
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='eut_draft_maint') THEN
    RAISE EXCEPTION 'Dedicated maintenance role not provisioned' USING ERRCODE='42501';
  END IF;
END;
$guard$;

GRANT USAGE ON SCHEMA public,eut_moderation TO eut_draft_maint;
GRANT SELECT(owner_id,expires_at),DELETE ON public.eut_technician_drafts TO eut_draft_maint;
CREATE POLICY eut_draft_maintenance_select_expired
  ON public.eut_technician_drafts FOR SELECT TO eut_draft_maint
  USING (expires_at <= clock_timestamp());
CREATE POLICY eut_draft_maintenance_delete_expired
  ON public.eut_technician_drafts FOR DELETE TO eut_draft_maint
  USING (expires_at <= clock_timestamp());
GRANT EXECUTE ON FUNCTION eut_moderation.eut_purge_expired_technician_drafts(integer)
  TO eut_draft_maint;
COMMIT;

-- Deployment prerequisite (not executable code): a privileged maintenance job
-- must invoke SELECT eut_moderation.eut_purge_expired_technician_drafts(500)
-- at an approved daily cadence, with aggregated counts, bounded retries,
-- access controls, rollback planning and failure monitoring. The dedicated
-- project currently lacks pg_cron, so there is deliberately no cron.schedule.
