-- Reproduce public function's original grants and owner exactly.
REVOKE ALL ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer) TO anon;
GRANT EXECUTE ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer) TO authenticated;
-- Exact baseline definitions and ACL: abort if the synthetic fixture differs.
DO $pre$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM pg_catalog.pg_proc
    WHERE oid='public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)'::regprocedure;
  IF pg_catalog.md5(p.prosrc) <> '6281c5ed1278763d3dfa56538f49ff99'
     OR p.proacl::text <> '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}'
  THEN RAISE EXCEPTION 'Synthetic fixture differs from audited live function: MD5 %, ACL %',
    pg_catalog.md5(p.prosrc),p.proacl::text; END IF;
  RAISE NOTICE 'PASS: initial PG17 function body and grants match production metadata';
END;
$pre$;
CREATE TEMP TABLE original_metadata AS
  SELECT pg_catalog.to_jsonb(p)-'prosrc' AS meta, pg_catalog.md5(p.prosrc) AS body_md5
  FROM pg_catalog.pg_proc p WHERE p.oid=
    'public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)'::regprocedure;
DO $before$
DECLARE names text[];
BEGIN
 SELECT array_agg(x->>'display_name' ORDER BY x->>'display_name') INTO names
 FROM public.eut_public_admin_technicians(_limit=>200) x;
 IF names IS DISTINCT FROM ARRAY['Invalido sintetico','Valido sintetico']::text[] THEN
  RAISE EXCEPTION 'Expected baseline valid+invalid, got %',names;
 END IF;
 RAISE NOTICE 'PASS: baseline shows valid+invalid only; suspended, blocked, inactive, demo and archived excluded';
END;
$before$;
\i /qa/forward.sql
DO $after$
DECLARE names text[]; curr_meta jsonb; curr_body text;
BEGIN
 SELECT array_agg(x->>'display_name' ORDER BY x->>'display_name') INTO names
 FROM public.eut_public_admin_technicians(_limit=>200) x;
 IF names IS DISTINCT FROM ARRAY['Valido sintetico']::text[] THEN
  RAISE EXCEPTION 'Corrected public projection differs: %',names;
 END IF;
 SELECT pg_catalog.to_jsonb(p)-'prosrc',pg_catalog.md5(p.prosrc)
  INTO curr_meta,curr_body FROM pg_catalog.pg_proc p WHERE p.oid=
   'public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)'::regprocedure;
 IF curr_meta IS DISTINCT FROM (SELECT meta FROM original_metadata) OR
  curr_body <> 'beab84411323cf450768fc5f2dc59743'
 THEN RAISE EXCEPTION 'pg_proc metadata changed beyond authorized predicate'; END IF;
 RAISE NOTICE 'PASS: correction excludes invalid phone; metadata and grants exactly preserved';
END;
$after$;
SET ROLE anon;
DO $anon$
DECLARE names text[];
BEGIN
 SELECT array_agg(x->>'display_name') INTO names
 FROM public.eut_public_admin_technicians(_limit=>3) x;
 IF names IS DISTINCT FROM ARRAY['Valido sintetico']::text[] THEN
  RAISE EXCEPTION 'anon output drifted: %',names;
 END IF;
 RAISE NOTICE 'PASS: anon EXECUTE exposes only eligible profile, no private phone';
END;
$anon$;
RESET ROLE;
\i /qa/rollback.sql
DO $undo$
DECLARE names text[]; curr_meta jsonb; curr_body text;
BEGIN
 SELECT array_agg(x->>'display_name' ORDER BY x->>'display_name') INTO names
 FROM public.eut_public_admin_technicians(_limit=>200) x;
 IF names IS DISTINCT FROM ARRAY['Invalido sintetico','Valido sintetico']::text[] THEN
  RAISE EXCEPTION 'Rollback did not exactly restore prior public projection: %',names;
 END IF;
 SELECT pg_catalog.to_jsonb(p)-'prosrc',pg_catalog.md5(p.prosrc)
  INTO curr_meta,curr_body FROM pg_catalog.pg_proc p WHERE p.oid=
   'public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)'::regprocedure;
 IF curr_meta IS DISTINCT FROM (SELECT meta FROM original_metadata) OR
  curr_body IS DISTINCT FROM (SELECT body_md5 FROM original_metadata)
 THEN RAISE EXCEPTION 'Rollback did not restore exact original function metadata+body'; END IF;
 RAISE NOTICE 'PASS: rollback restores original projection, body, pg_proc metadata and grants';
END;
$undo$;
