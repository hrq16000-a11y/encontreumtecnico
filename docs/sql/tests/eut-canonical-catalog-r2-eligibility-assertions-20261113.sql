-- ONLY disposable PostgreSQL 17, after R1 synthetic + legacy-contract gates.
-- This suite tests the R2 proposal, NOT live hosted Supabase, Auth or PSP.
\echo 'R2: captured canonical identity must be stable; no invented place or service'
SELECT pg_catalog.set_config('qa.r2.authless',
  (SELECT technician_id::text FROM eut_moderation.catalog_provenance
    WHERE catalog_origin='admin_manual' AND source_key='manual:lead-001'),false);
SELECT pg_catalog.set_config('qa.r2.disabled',
  (SELECT technician_id::text FROM eut_moderation.catalog_provenance
    WHERE catalog_origin='wordpress' AND source_key='wp:old-42'),false);
SELECT pg_catalog.set_config('qa.r2.withcity',
  (SELECT technician_id::text FROM eut_moderation.catalog_provenance
    WHERE catalog_origin='external_import' AND source_key='capture:two-01'),false);
DO $qa$
DECLARE v_id uuid:=current_setting('qa.r2.authless')::uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.technicians t WHERE t.id=v_id
       AND t.user_id IS NULL AND t.catalog_enabled IS TRUE
       AND t.status='pendente'::public.approval_status
       AND t.display_name IS NULL AND t.city IS NULL
       AND cardinality(t.coverage_city_ids)=0)
 THEN RAISE EXCEPTION 'Canonical Auth-less minimalist identity changed'; END IF;
 IF NOT eut_visibility.eut_public_technician_eligible(v_id) THEN
   RAISE EXCEPTION 'Audited enabled Auth-less technician was rejected'; END IF;
 IF NOT eut_visibility.eut_public_technician_eligible(
    '10000000-0000-4000-8000-000000000007') THEN
   RAISE EXCEPTION 'Legitimate approved Auth technician disappeared'; END IF;
 IF eut_visibility.eut_public_technician_eligible(
    '10000000-0000-4000-8000-000000000001') THEN
   RAISE EXCEPTION 'Blocked Auth account was made eligible'; END IF;
 IF eut_visibility.eut_public_technician_eligible(
    '10000000-0000-4000-8000-000000000002') THEN
   RAISE EXCEPTION 'Suspended Auth account was made eligible'; END IF;
 IF eut_visibility.eut_public_technician_eligible(
    current_setting('qa.r2.disabled')::uuid) THEN
   RAISE EXCEPTION 'Disabled canonical import was made eligible'; END IF;
 IF NOT eut_visibility.eut_public_technician_eligible(
    current_setting('qa.r2.withcity')::uuid) THEN
   RAISE EXCEPTION 'Audited imported record with a declared city was rejected'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians t
   WHERE t.id=current_setting('qa.r2.withcity')::uuid
     AND cardinality(t.coverage_city_ids)>0) THEN
   RAISE EXCEPTION 'Imported city was falsely declared as IBGE coverage'; END IF;
END $qa$;

\echo 'R2: unknown/historical references, missing audit and mismatched provenance denied'
-- These raw INSERTs are a privileged FIXTURE representing prohibited bypasses.
-- No Auth user is created for any of them. They must never be public.
INSERT INTO public.technicians
 (id,user_id,display_name,city,status,catalog_enabled,catalog_origin)
VALUES
 ('20000000-0000-4000-8000-000000000001',NULL,'Histórico não verificado',NULL,'pendente',true,'external_import'),
 ('20000000-0000-4000-8000-000000000002',NULL,'Sem auditoria',NULL,'pendente',true,'admin_manual'),
 ('20000000-0000-4000-8000-000000000003',NULL,'Sem procedência',NULL,'pendente',true,'admin_manual'),
 ('20000000-0000-4000-8000-000000000004',NULL,'Origem divergente',NULL,'pendente',true,'external_import'),
 ('20000000-0000-4000-8000-000000000005',NULL,'Habilitação ausente',NULL,'pendente',NULL,'admin_manual');
INSERT INTO eut_moderation.catalog_provenance(technician_id,catalog_origin,source_key)
VALUES
 ('20000000-0000-4000-8000-000000000002','admin_manual','qa:no-audit'),
 ('20000000-0000-4000-8000-000000000004','admin_manual','qa:origin-mismatch'),
 ('20000000-0000-4000-8000-000000000005','admin_manual','qa:null-enable');
INSERT INTO public.eut_admin_management_log(
 actor_id,target_type,target_key,action,reason,before_state,after_state
) VALUES
 ('00000000-0000-4000-8000-000000000001','technician',
  '20000000-0000-4000-8000-000000000003','catalog_created',
  'QA auditada sem procedência','{}'::jsonb,
  '{"origin":"admin_manual","catalog_enabled":true,"auth_user_created":false}'::jsonb),
 ('00000000-0000-4000-8000-000000000001','technician',
  '20000000-0000-4000-8000-000000000004','catalog_created',
  'QA origem divergente','{}'::jsonb,
  '{"origin":"external_import","catalog_enabled":true,"auth_user_created":false}'::jsonb),
 ('00000000-0000-4000-8000-000000000001','technician',
  '20000000-0000-4000-8000-000000000005','catalog_created',
  'QA sem habilitação','{}'::jsonb,
  '{"origin":"admin_manual","catalog_enabled":true,"auth_user_created":false}'::jsonb);
DO $qa$
DECLARE v_id uuid;
BEGIN
 FOR v_id IN SELECT id FROM public.technicians
   WHERE id::text LIKE '20000000-0000-4000-8000-00000000000%'
 LOOP
   IF eut_visibility.eut_public_technician_eligible(v_id) THEN
     RAISE EXCEPTION 'Unverified or provenance-mismatched UUID was eligible: %',v_id;
   END IF;
 END LOOP;
END $qa$;

\echo 'R2: reject/restrict pending Auth and disabled/suspended imported profiles'
INSERT INTO auth.users(id,email_confirmed_at)
 VALUES('00000000-0000-4000-8000-000000000008',now());
INSERT INTO public.profiles(id)
 VALUES('00000000-0000-4000-8000-000000000008');
INSERT INTO public.user_roles(user_id,role)
 VALUES('00000000-0000-4000-8000-000000000008','tecnico');
INSERT INTO public.technicians(id,user_id,display_name,city,status)
 VALUES('20000000-0000-4000-8000-000000000008',
   '00000000-0000-4000-8000-000000000008','Novo Auth pendente','Curitiba','pendente');
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT pg_catalog.set_config('qa.r2.rejected',
  (public.eut_admin_catalog_upsert('admin_manual','qa:r2-rejected',
    'Prestador rejeitado',NULL,NULL,NULL,'Recusa sintética sem exposição')
    ->>'technician_id'),false);
SELECT pg_catalog.set_config('qa.r2.suspended',
  (public.eut_admin_catalog_upsert('admin_manual','qa:r2-suspended',
    'Prestador suspenso',NULL,NULL,NULL,'Suspensão sintética sem exposição')
    ->>'technician_id'),false);
UPDATE public.technicians SET status='rejeitado'
 WHERE id=current_setting('qa.r2.rejected')::uuid;
UPDATE public.technicians SET status='suspenso'
 WHERE id=current_setting('qa.r2.suspended')::uuid;
DO $qa$
BEGIN
 IF eut_visibility.eut_public_technician_eligible('20000000-0000-4000-8000-000000000008')
  OR eut_visibility.eut_public_technician_eligible(current_setting('qa.r2.rejected')::uuid)
  OR eut_visibility.eut_public_technician_eligible(current_setting('qa.r2.suspended')::uuid)
 THEN RAISE EXCEPTION 'Pending Auth or suspended/rejected import exposed'; END IF;
END $qa$;

\echo 'R2: dynamic blocked phone veto with removal recovery'
DO $qa$
DECLARE v_id uuid:=current_setting('qa.r2.authless')::uuid;
BEGIN
 INSERT INTO eut_moderation.blocked_phones(phone_digits,reason_internal)
   VALUES('5541999998080','R2 blocker fixture') ON CONFLICT DO NOTHING;
 IF eut_visibility.eut_public_technician_eligible(v_id) THEN
   RAISE EXCEPTION 'Blocked private phone did not veto public eligibility'; END IF;
 DELETE FROM eut_moderation.blocked_phones WHERE phone_digits='5541999998080';
 IF NOT eut_visibility.eut_public_technician_eligible(v_id) THEN
   RAISE EXCEPTION 'Removal of synthetic block failed to restore eligibility'; END IF;
END $qa$;

\echo 'R2: private grants inspected as fixture owner; roles cannot resolve private schemas'
DO $qa$
BEGIN
 IF has_table_privilege('anon','eut_moderation.catalog_private_contacts','SELECT')
    OR has_table_privilege('anon','eut_moderation.catalog_provenance','SELECT')
    OR has_table_privilege('anon','eut_moderation.blocked_phones','SELECT')
    OR has_table_privilege('authenticated','eut_moderation.catalog_private_contacts','SELECT')
    OR has_table_privilege('authenticated','eut_moderation.catalog_provenance','SELECT')
 THEN RAISE EXCEPTION 'Private catalog/provenance privileges were granted'; END IF;
END $qa$;

\echo 'R2: anonymous direct SELECT and RPC expose ONLY authorized rows'
SET request.jwt.claim.sub='';
SET ROLE anon;
DO $qa$
DECLARE
 v_id uuid:=current_setting('qa.r2.authless')::uuid;
 v_ids uuid[]:=ARRAY[
  current_setting('qa.r2.authless')::uuid,
  current_setting('qa.r2.disabled')::uuid,
  '20000000-0000-4000-8000-000000000001'::uuid,
  '20000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-000000000003'::uuid,
  '20000000-0000-4000-8000-000000000004'::uuid,
  '20000000-0000-4000-8000-000000000005'::uuid,
  '20000000-0000-4000-8000-000000000008'::uuid,
  '10000000-0000-4000-8000-000000000007'::uuid
 ];
 n int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.technicians WHERE id=v_id) THEN
   RAISE EXCEPTION 'RLS anonymous cannot see audited enabled canonical ID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.technicians
   WHERE id='10000000-0000-4000-8000-000000000007') THEN
   RAISE EXCEPTION 'RLS anonymous lost legitimate Auth profile'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians t WHERE t.id=ANY(v_ids)
   AND t.id<>v_id
   AND t.id<>'10000000-0000-4000-8000-000000000007') THEN
   RAISE EXCEPTION 'RLS anonymous exposed a denied record'; END IF;
 SELECT count(*) INTO n FROM public.eut_public_eligible_technician_ids(v_ids);
 IF n<>2 THEN RAISE EXCEPTION 'RPC expected two eligible IDs, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.eut_public_eligible_technician_ids(v_ids) r
   WHERE r.technician_id NOT IN
    (v_id,'10000000-0000-4000-8000-000000000007'::uuid)) THEN
   RAISE EXCEPTION 'RPC exposed extra profile ID'; END IF;
 IF EXISTS(SELECT 1 FROM public.eut_public_eligible_technician_ids(NULL::uuid[]))
   OR EXISTS(SELECT 1 FROM public.eut_public_eligible_technician_ids(ARRAY[]::uuid[]))
 THEN RAISE EXCEPTION 'RPC accepted null/empty candidate set'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute
     WHERE attrelid='public.technicians'::regclass
       AND attname IN ('phone_e164','source_key','private_phone') AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Private phone or source key leaked into public table'; END IF;
END $qa$;
RESET ROLE;

\echo 'R2: ordinary authenticated client and management reads do not expand'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SET ROLE authenticated;
DO $qa$
DECLARE v_id uuid:=current_setting('qa.r2.authless')::uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.technicians WHERE id=v_id)
 THEN RAISE EXCEPTION 'Normal authenticated public search no longer sees eligible ID'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians
   WHERE id=current_setting('qa.r2.disabled')::uuid
      OR id='20000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Client accessed disabled/quarantined candidate'; END IF;
END $qa$;
RESET ROLE;

SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.technicians
    WHERE id=current_setting('qa.r2.disabled')::uuid)
 THEN RAISE EXCEPTION 'Verified admin lost disabled catalog management visibility'; END IF;
END $qa$;
RESET ROLE;

\echo 'R2: legacy paid-contact path must NOT unlock Auth-less private phone'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
DO $qa$
DECLARE reply jsonb;
BEGIN
 reply:=public.eut_reveal_paid_technician_contact(
   current_setting('qa.r2.authless')::uuid);
 IF reply->>'status'<>'contato_indisponivel' OR reply ? 'phone'
 THEN RAISE EXCEPTION 'Auth-less public eligibility incorrectly released paid phone'; END IF;
END $qa$;
RESET ROLE;
\echo 'PASS R2: Auth + audited Auth-less visibility; bans, privacy, RLS, contacts, null fields and quarantine'
