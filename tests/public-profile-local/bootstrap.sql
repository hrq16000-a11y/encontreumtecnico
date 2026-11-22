-- Exclusively disposable localhost Supabase for the public-profile browser QA.
-- Never apply this file to the dedicated EUT database.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS service_radius_km integer,
  ADD COLUMN IF NOT EXISTS coverage_city_ids integer[] NOT NULL DEFAULT '{}'::integer[];
COMMIT;
