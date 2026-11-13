-- TEST ONLY: isolated Postgres 16, seeded by the existing synthetic admin fixture.
\echo 'EUT canonical R1: legacy flags and timestamps preserved'
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.technicians t
   JOIN public.qa_r1_legacy_versions b ON b.id=t.id
   WHERE t.catalog_enabled IS NOT NULL
     OR t.updated_at IS DISTINCT FROM b.updated_at
     OR t.status IS DISTINCT FROM b.status
     OR t.public_slug IS DISTINCT FROM b.public_slug)
 THEN RAISE EXCEPTION 'Historic record was rewritten during migration'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.technicians t
    WHERE t.user_id='00000000-0000-4000-8000-000000000003'
      AND t.status='aprovado' AND t.catalog_enabled IS NULL)
 THEN RAISE EXCEPTION 'Banned legacy record changed'; END IF;
END $qa$;
\echo 'EUT canonical R1: source keys never in public table'
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_attribute
   WHERE attrelid='public.technicians'::regclass AND attname='catalog_source_key'
     AND NOT attisdropped) THEN RAISE EXCEPTION 'Public origin/source key leak'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='eut_moderation' AND c.relname='catalog_provenance'
   AND c.relrowsecurity) THEN RAISE EXCEPTION 'Private provenance RLS missing'; END IF;
END $qa$;
\echo 'EUT canonical R1: reject anonymous and non-admin'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET ROLE anon;
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_catalog_upsert(
 'admin_manual','manual:forbidden','Não autorizado',NULL,NULL,'(41) 99999-8080',
 'Negar gravação de visitante');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous upsert allowed'; END IF;
END $qa$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_catalog_upsert(
 'admin_manual','manual:client','Não autorizado',NULL,NULL,'(41) 99999-8080',
 'Negar gravação de cliente');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Client upsert allowed'; END IF;
END $qa$;
RESET ROLE;

\echo 'EUT canonical R1: no Auth account, no invented municipality or category'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $qa$
DECLARE result jsonb; v_id uuid; v_users integer; v_repeat jsonb;
BEGIN
 SELECT count(*) INTO v_users FROM auth.users;
 result:=public.eut_admin_catalog_upsert(
  'admin_manual','manual:lead-001',NULL,NULL,NULL,'(41) 99999-8080',
  'Cadastro telefônico originado do administrador');
 IF result->>'ok'<>'true' OR result->>'created'<>'true'
   OR result->>'catalog_enabled'<>'true' OR result->>'published'<>'false'
 THEN RAISE EXCEPTION 'Creation not confirmed'; END IF;
 v_id:=(result->>'technician_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.technicians t WHERE t.id=v_id
    AND t.user_id IS NULL AND t.display_name IS NULL AND t.city IS NULL
    AND t.state_uf IS NULL AND t.catalog_enabled AND t.status='pendente'
    AND t.ddd_hint='41' AND cardinality(t.specialties)=0)
 THEN RAISE EXCEPTION 'No exact canonical Auth-less row'; END IF;
 IF (SELECT count(*) FROM auth.users)<>v_users THEN
   RAISE EXCEPTION 'Fake Auth account created'; END IF;
 IF NOT EXISTS(SELECT 1 FROM eut_moderation.catalog_private_contacts c
     WHERE c.technician_id=v_id AND c.phone_e164='+5541999998080'
       AND c.allow_paid_contact=false)
 THEN RAISE EXCEPTION 'Phone not stored privately'; END IF;
 IF NOT EXISTS(SELECT 1 FROM eut_moderation.catalog_provenance p
     WHERE p.technician_id=v_id AND p.catalog_origin='admin_manual'
       AND p.source_key='manual:lead-001')
 THEN RAISE EXCEPTION 'Private source key not persisted'; END IF;
 -- Actual hosted technicians.public_slug is NOT NULL and assigned by trigger.
 IF (SELECT public_slug FROM public.technicians WHERE id=v_id)<>'tecnico' THEN
   RAISE EXCEPTION 'Required slug trigger failed for null name and city'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians
    WHERE id=v_id AND public_slug ~ '99999|8080') THEN
   RAISE EXCEPTION 'Phone must not leak into slug'; END IF;
 IF EXISTS(SELECT 1 FROM public.eut_admin_management_log a
   WHERE a.target_key=v_id::text AND (
    a.before_state::text LIKE '%999998080%' OR
    a.after_state::text LIKE '%999998080%'))
 THEN RAISE EXCEPTION 'Private phone leaked in audit'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log a
     WHERE a.target_key=v_id::text AND a.action='catalog_created')
 THEN RAISE EXCEPTION 'Audit absent'; END IF;
 v_repeat:=public.eut_admin_catalog_upsert(
  'admin_manual','manual:lead-001',NULL,NULL,NULL,'(41) 99999-8080',
  'Repetição idempotente do cadastro telefônico');
 IF v_repeat->>'created'<>'false' OR v_repeat->>'technician_id'<>v_id::text
 THEN RAISE EXCEPTION 'Non-idempotent import'; END IF;
 IF (SELECT count(*) FROM public.eut_admin_management_log
     WHERE target_key=v_id::text AND action='catalog_created')<>1
 THEN RAISE EXCEPTION 'Duplicate audit event'; END IF;
 -- Same telephone, distinct provenance: do not merge identities by phone.
 v_repeat:=public.eut_admin_catalog_upsert(
  'external_import','archive:record-111',NULL,NULL,NULL,'(41) 99999-8080',
  'Outra origem permanece separada para reconciliação');
 IF v_repeat->>'technician_id'=v_id::text THEN
   RAISE EXCEPTION 'Phone collision wrongly merged identities'; END IF;
 IF (SELECT public_slug FROM public.technicians
   WHERE id=(v_repeat->>'technician_id')::uuid)
   <> 'tecnico-'||left(replace(v_repeat->>'technician_id','-',''),12) THEN
     RAISE EXCEPTION 'Slug collision trigger must use the ID suffix'; END IF;
 v_repeat:=public.eut_admin_catalog_upsert(
  'admin_manual','manual:lead-001',NULL,NULL,NULL,'(41) 99999-7070',
  'Proibir troca silenciosa do telefone original');
 IF v_repeat->>'conflict'<>'true' THEN
   RAISE EXCEPTION 'Same source phone overwrite was not rejected'; END IF;
END $qa$;

\echo 'EUT canonical R1: batch, versioned enable/disable, preservation'
DO $qa$
DECLARE v_batch jsonb; v_result jsonb; v_id uuid; v_version timestamptz; v_reply jsonb; v_denied boolean;
BEGIN
 v_batch:=jsonb_build_array(
   jsonb_build_object('origin','external_import','source_key','capture:two-01',
      'label','Oficina Origem', 'city_ibge',4106902, 'category_slug','computadores',
      'phone','+55 (41) 99999-7070'),
   jsonb_build_object('origin','wordpress','source_key','wp:old-42',
      'label','Prestador antigo')
 );
 v_result:=public.eut_admin_catalog_import_batch(v_batch,'Importação sintética em dois lotes');
 IF v_result->>'processed'<>'2' OR v_result->>'ok'<>'true'
 THEN RAISE EXCEPTION 'Batch failed'; END IF;
 v_result:=public.eut_admin_catalog_import_batch(v_batch,'Repetição segura do lote sintético');
 IF (v_result->'results'->0->>'created')<>'false' OR
    (v_result->'results'->1->>'created')<>'false'
 THEN RAISE EXCEPTION 'Batch replay was not idempotent'; END IF;
 SELECT id,updated_at INTO v_id,v_version FROM public.technicians
 WHERE catalog_origin='wordpress' AND id=(
   SELECT technician_id FROM eut_moderation.catalog_provenance
     WHERE catalog_origin='wordpress' AND source_key='wp:old-42');
 v_reply:=public.eut_admin_catalog_set_enabled(v_id,v_version,false,'Desabilitação administrativa explícita');
 IF v_reply->>'catalog_enabled'<>'false' OR NOT EXISTS (
    SELECT 1 FROM public.technicians WHERE id=v_id AND catalog_enabled=false
 ) THEN RAISE EXCEPTION 'Disable did not persist'; END IF;
 v_result:=public.eut_admin_catalog_import_batch(v_batch,'Reimportação após desabilitar ficha');
 IF (SELECT catalog_enabled FROM public.technicians WHERE id=v_id) THEN
    RAISE EXCEPTION 'Reimport silently re-enabled disabled record'; END IF;
 v_denied:=false;
 BEGIN PERFORM public.eut_admin_catalog_set_enabled(v_id,v_version,true,
  'Atualização concorrente deve ser recusada');
 EXCEPTION WHEN SQLSTATE '40001' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Stale version accepted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log
 WHERE target_key=v_id::text AND action='catalog_enabled_changed')
 THEN RAISE EXCEPTION 'Disable audit missing'; END IF;
END $qa$;

\echo 'EUT canonical R1: hosted phone format, RLS and NULL batch compatibility'
DO $qa$
DECLARE bad boolean; before_count integer;
BEGIN
 SELECT count(*) INTO before_count FROM public.technicians;
 bad:=false;
 BEGIN PERFORM public.eut_admin_catalog_upsert(
  'admin_manual','manual:bad-leading','Teste QA',NULL,NULL,
  '(41) 1333-4444','Recusar assinante com primeiro dígito inválido');
 EXCEPTION WHEN SQLSTATE '22023' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'Invalid subscriber accepted'; END IF;
 bad:=false;
 BEGIN PERFORM public.eut_admin_catalog_upsert(
  'admin_manual','manual:bad-ddd','Teste QA',NULL,NULL,
  '(10) 99999-8080','Recusar DDD inválido');
 EXCEPTION WHEN SQLSTATE '22023' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'Invalid DDD accepted'; END IF;
 bad:=false;
 BEGIN PERFORM public.eut_admin_catalog_upsert(
  'admin_manual','manual:bad-ramal','Teste QA',NULL,NULL,
  '(41) 99999-8080 ramal 3','Recusar texto extra em telefone');
 EXCEPTION WHEN SQLSTATE '22023' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'Extension silently normalized'; END IF;
 bad:=false;
 BEGIN PERFORM public.eut_admin_catalog_import_batch(NULL,'Recusar lote nulo');
 EXCEPTION WHEN SQLSTATE '22023' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'NULL batch accepted'; END IF;
 IF (SELECT count(*) FROM public.technicians)<>before_count THEN
   RAISE EXCEPTION 'Invalid input wrote a catalog record'; END IF;
 IF has_table_privilege('anon','eut_moderation.catalog_private_contacts','SELECT') OR
    has_table_privilege('authenticated','eut_moderation.catalog_private_contacts','SELECT') OR
    NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid='eut_moderation.catalog_private_contacts'::regclass) THEN
   RAISE EXCEPTION 'Private contact grants/RLS incorrect'; END IF;
 IF (SELECT count(*) FROM public.eut_technician_private_contacts)<>2 THEN
   RAISE EXCEPTION 'Existing Auth contacts changed'; END IF;
END $qa$;
\echo 'EUT canonical R1: invalid input and banned phone rollback'
DO $qa$
DECLARE denied boolean; v_before bigint;
BEGIN
 INSERT INTO eut_moderation.blocked_phones(phone_digits,reason_internal)
 VALUES('5541999996060','Bloqueio sintético');
 SELECT count(*) INTO v_before FROM public.technicians;
 denied:=false;
 BEGIN PERFORM public.eut_admin_catalog_upsert(
  'external_import','capture:blocked-1',NULL,NULL,NULL,'(41) 99999-6060',
  'Recusar contato com restrição vigente');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied OR (SELECT count(*) FROM public.technicians)<>v_before THEN
    RAISE EXCEPTION 'Banned phone inserted'; END IF;
 denied:=false;
 BEGIN PERFORM public.eut_admin_catalog_upsert(
  'external_import','capture:badcity','Nome válido',1234567,NULL,NULL,
  'Recusar município não confirmado');
 EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid IBGE city accepted'; END IF;
 denied:=false;
 BEGIN PERFORM public.eut_admin_catalog_upsert(
  'external_import','capture:invalid','',NULL,NULL,NULL,
  'Recusar cadastro sem qualquer identificador');
 EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Empty catalog row accepted'; END IF;
END $qa$;

\echo 'EUT canonical R1: audit failure must rollback record and phone'
CREATE OR REPLACE FUNCTION public.qa_fail_catalog_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action='catalog_created' AND NEW.reason LIKE 'Falha forçada%' THEN
   RAISE EXCEPTION 'Falha forçada de auditoria' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER qa_fail_catalog_audit BEFORE INSERT ON public.eut_admin_management_log
FOR EACH ROW EXECUTE FUNCTION public.qa_fail_catalog_audit();
DO $qa$
DECLARE failed boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_catalog_upsert(
   'admin_manual','manual:atomic-1','Teste de rollback',NULL,NULL,'(41) 99999-5050',
   'Falha forçada no registro auditado');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN failed:=true; END;
 IF NOT failed OR EXISTS (
  SELECT 1 FROM eut_moderation.catalog_provenance p
    WHERE p.catalog_origin='admin_manual' AND p.source_key='manual:atomic-1'
 ) OR EXISTS (
  SELECT 1 FROM eut_moderation.catalog_private_contacts c
   WHERE c.phone_e164='+5541999995050'
 ) THEN RAISE EXCEPTION 'Audit rollback leaked record or contact'; END IF;
END $qa$;
DROP TRIGGER qa_fail_catalog_audit ON public.eut_admin_management_log;

\echo 'EUT canonical R1: unaudited direct toggle must be blocked'
DO $qa$
DECLARE v_id uuid; rejected boolean:=false;
BEGIN
 SELECT technician_id INTO v_id FROM eut_moderation.catalog_provenance
 WHERE catalog_origin='admin_manual' AND source_key='manual:lead-001';
 BEGIN UPDATE public.technicians SET catalog_enabled=false WHERE id=v_id;
 EXCEPTION WHEN SQLSTATE '42501' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unaudited toggle was permitted'; END IF;
 IF NOT (SELECT catalog_enabled FROM public.technicians WHERE id=v_id)
 THEN RAISE EXCEPTION 'Unaudited toggle persisted'; END IF;
END $qa$;
\echo 'EUT canonical R1: private contacts and provenance denied to anonymous'
SET ROLE anon;
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN EXECUTE 'SELECT 1 FROM eut_moderation.catalog_private_contacts LIMIT 1';
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous private access succeeded'; END IF;
 denied:=false;
 BEGIN EXECUTE 'SELECT 1 FROM eut_moderation.catalog_provenance LIMIT 1';
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous provenance access succeeded'; END IF;
END $qa$;
RESET ROLE;

\echo 'EUT canonical R1: admin-only paged readback, no phone or source key'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $qa$
DECLARE v_id uuid; v_result jsonb; v_rows jsonb; v_row jsonb;
        v_bad jsonb; v_existing uuid;
BEGIN
 SELECT technician_id INTO v_id FROM eut_moderation.catalog_provenance
   WHERE catalog_origin='admin_manual' AND source_key='manual:lead-001';
 IF v_id IS NULL THEN RAISE EXCEPTION 'Missing prepared canonical fixture'; END IF;

 v_result:=public.eut_admin_catalog_list(0,20,'',ARRAY[v_id]);
 v_rows:=v_result->'rows';
 IF v_result->>'ok'<>'true' OR (v_result->>'total')::int<>1 OR
    jsonb_array_length(v_rows)<>1
 THEN RAISE EXCEPTION 'Read by ID did not persist or paginate'; END IF;
 v_row:=v_rows->0;
 IF v_row->>'id'<>v_id::text OR v_row->>'catalog_enabled'<>'true'
    OR v_row->>'has_private_contact'<>'true'
    OR (v_row->>'last_audit_id')::bigint<=0
 THEN RAISE EXCEPTION 'Creation readback has no state/audit'; END IF;
 IF v_row ? 'phone_e164' OR v_row ? 'source_key' OR
    v_row ? 'catalog_source_key' OR v_row ? 'user_id' OR
    v_result::text LIKE '%5541999998080%' OR
    v_result::text LIKE '%manual:lead-001%'
 THEN RAISE EXCEPTION 'Private data leaked in admin list'; END IF;
 v_result:=public.eut_admin_catalog_list(0,1,'',NULL);
 IF (v_result->>'limit')::integer<>1 OR jsonb_array_length(v_result->'rows')>1
 THEN RAISE EXCEPTION 'Pagination limit ignored'; END IF;
 v_result:=public.eut_admin_catalog_list(0,20,'Padrão inexistente',NULL);
 IF (v_result->>'total')::integer<>0 OR jsonb_array_length(v_result->'rows')<>0
 THEN RAISE EXCEPTION 'Empty search state wrong'; END IF;

 SELECT technician_id INTO v_existing FROM eut_moderation.catalog_provenance
  WHERE catalog_origin='wordpress' AND source_key='wp:old-42';
 v_result:=public.eut_admin_catalog_list(0,20,'',ARRAY[v_existing]);
 IF v_result->'rows'->0->>'catalog_enabled'<>'false' OR
     (v_result->'rows'->0->>'last_audit_id')::bigint<=0
 THEN RAISE EXCEPTION 'Disabled record/audit did not survive readback'; END IF;

 BEGIN PERFORM public.eut_admin_catalog_list(0,51,'',NULL);
   RAISE EXCEPTION 'Oversized admin result accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $qa$;

\echo 'EUT canonical R1: anonymous and client cannot list private catalog'
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
  BEGIN PERFORM public.eut_admin_catalog_list(0,20,'',NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Client read private catalog'; END IF;
END $qa$;
RESET ROLE;
SET ROLE anon;
DO $qa$
DECLARE denied boolean:=false;
BEGIN
  BEGIN PERFORM public.eut_admin_catalog_list(0,20,'',NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous read private catalog'; END IF;
END $qa$;
RESET ROLE;
\echo 'QA passed: canonical IDs, imported batches, privacy, audit, admin readback and toggle'
