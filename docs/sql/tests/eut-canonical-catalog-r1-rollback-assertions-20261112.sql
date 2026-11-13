-- After successful R1 rollback in clean, separate CI database.
\echo 'R1 rollback: original records, contacts, permissions and audit preserved'
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND table_name='technicians' AND column_name IN ('catalog_enabled','catalog_origin','ddd_hint'))
 THEN RAISE EXCEPTION 'R1 columns remain after rollback'; END IF;
 IF to_regclass('eut_moderation.catalog_private_contacts') IS NOT NULL OR
    to_regclass('eut_moderation.catalog_provenance') IS NOT NULL
 THEN RAISE EXCEPTION 'Private R1 tables remain'; END IF;
 IF to_regprocedure('public.eut_admin_catalog_list(integer,integer,text,uuid[])') IS NOT NULL
 THEN RAISE EXCEPTION 'R1 RPC remains'; END IF;
 IF to_regprocedure('public.eut_admin_catalog_update(uuid,timestamptz,bigint,jsonb,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Versioned Update RPC remains after rollback'; END IF;
 IF (SELECT count(*) FROM public.technicians)<>2 OR
    (SELECT count(*) FROM public.eut_technician_private_contacts)<>2
 THEN RAISE EXCEPTION 'Historic technicians/private contacts were lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians t
   JOIN public.qa_r1_legacy_versions b ON b.id=t.id
   WHERE t.updated_at IS DISTINCT FROM b.updated_at
     OR t.status IS DISTINCT FROM b.status
     OR t.public_slug IS DISTINCT FROM b.public_slug)
 THEN RAISE EXCEPTION 'Historic field/timestamps changed by migration rollback'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log
   WHERE action='catalog_r1_rollback'
     AND actor_id='00000000-0000-4000-8000-000000000001'
     AND after_state->>'legacy_preserved'='true')
 THEN RAISE EXCEPTION 'Rollback audit absent'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='technicians'
     AND column_name IN ('user_id','display_name','city') AND is_nullable='YES')
 THEN RAISE EXCEPTION 'Legacy NOT NULL constraints not restored'; END IF;
 IF (SELECT count(*) FROM pg_policies
   WHERE tablename='technicians' AND policyname IN ('eut_catalog_direct_insert_requires_owner',
                   'eut_catalog_direct_insert_requires_operational_account'))<>0
 THEN RAISE EXCEPTION 'New R1 RLS policy still installed'; END IF;
 IF (SELECT count(*) FROM pg_policies
   WHERE tablename='technicians' AND policyname IN (
   'Public reads approved','eut_public_visibility_anon_guard','eut_public_visibility_auth_guard')
   AND qual LIKE '%catalog_enabled%')<>0
 THEN RAISE EXCEPTION 'Original RLS not restored'; END IF;
END $qa$;
\echo 'QA passed: audited reversible R1 rollback and intact historic schema/data'
