-- R2 verification: read-only, no insertion or exposure.
-- Run in the exact Supabase EUT project after applying eut-ads-r2-private-foundation.sql.
DO $$
DECLARE
  name text;
  names text[] := ARRAY[
    'sponsors','placements','campaigns','creatives',
    'campaign_placements','staff_roles','audit_events'
  ];
  n integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='eut_ads') THEN
    RAISE EXCEPTION 'R2 ads schema missing';
  END IF;
  IF has_schema_privilege('anon','eut_ads','USAGE')
     OR has_schema_privilege('authenticated','eut_ads','USAGE') THEN
    RAISE EXCEPTION 'Private ads schema exposed';
  END IF;
  FOREACH name IN ARRAY names LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
      WHERE s.nspname='eut_ads' AND c.relname=name
        AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN RAISE EXCEPTION 'Ads RLS or force-RLS missing: %',name; END IF;
    IF has_table_privilege('anon',format('eut_ads.%I',name),'SELECT')
       OR has_table_privilege('authenticated',format('eut_ads.%I',name),'SELECT')
       OR has_table_privilege('authenticated',format('eut_ads.%I',name),'INSERT')
       OR has_table_privilege('authenticated',format('eut_ads.%I',name),'UPDATE')
       OR has_table_privilege('authenticated',format('eut_ads.%I',name),'DELETE')
    THEN RAISE EXCEPTION 'Ads direct table permission leaked: %',name; END IF;
  END LOOP;
  IF has_function_privilege('anon','eut_ads.capture_change()','EXECUTE')
    OR has_function_privilege('authenticated','eut_ads.capture_change()','EXECUTE')
  THEN RAISE EXCEPTION 'Ads audit trigger function exposed'; END IF;

  SELECT count(*) INTO n
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='eut_ads' AND t.tgname LIKE 'audit_%'
    AND t.tgisinternal=false;
  IF n<>6 THEN RAISE EXCEPTION 'Expected 6 audit triggers, got %',n; END IF;

  IF (SELECT count(*) FROM eut_ads.sponsors) <> 0
     OR (SELECT count(*) FROM eut_ads.placements) <> 0
     OR (SELECT count(*) FROM eut_ads.campaigns) <> 0
     OR (SELECT count(*) FROM eut_ads.creatives) <> 0
     OR (SELECT count(*) FROM eut_ads.campaign_placements) <> 0
     OR (SELECT count(*) FROM eut_ads.staff_roles) <> 0
     OR (SELECT count(*) FROM eut_ads.audit_events) <> 0
  THEN RAISE EXCEPTION 'Unexpected ads records; R2 should seed none'; END IF;

  RAISE NOTICE 'PASS: 7 private tables FORCE RLS; no anon/auth grants; six audit triggers; zero ads records';
END
$$;
