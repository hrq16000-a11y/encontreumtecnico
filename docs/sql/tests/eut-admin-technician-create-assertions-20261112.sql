-- ONLY disposable PostgreSQL; synthetic accounts. No hosted EUT data.
\echo 'EUT admin create: deny anonymous and unauthorized'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET ROLE anon;
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000006','Técnico de QA',4125506,
  'computadores','Teste negativo de autorização');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anon was permitted to provision technician'; END IF;
END $qa$;
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000006','Técnico de QA',4125506,
  'computadores','Cliente não pode criar técnico');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Client was permitted to provision technician'; END IF;
END $qa$;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000005';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000006','Técnico de QA',4125506,
  'computadores','Admin não confirmado deve falhar');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unverified admin was permitted'; END IF;
END $qa$;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $qa$
DECLARE rejected boolean; target uuid; city integer; slug text; result jsonb;
BEGIN
 -- Existing Auth with accepted technician role is required; no account invented.
 FOREACH target IN ARRAY ARRAY[
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000007'::uuid,
  '00000000-0000-4000-8000-000000000008'::uuid] LOOP
  rejected:=false;
  BEGIN PERFORM public.eut_admin_technician_create(
    target,'Técnico de QA',4125506,'computadores','Tentativa negada pela política');
  EXCEPTION WHEN SQLSTATE '42501' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Unqualified target was accepted %',target; END IF;
 END LOOP;
 FOR city IN SELECT id FROM public.eut_ibge_municipalities WHERE id=1200203 LOOP
  rejected:=false;
  BEGIN PERFORM public.eut_admin_technician_create(
    '00000000-0000-4000-8000-000000000006','Técnico de QA',9999999,
    'computadores','Município inventado deve falhar');
  EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Invalid city passed'; END IF;
 END LOOP;
 rejected:=false;
 BEGIN PERFORM public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000006','Técnico de QA',4125506,
  'desativada','Categoria inativa deve falhar');
 EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Inactive category passed'; END IF;

 result:=public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000006','Técnico QA Autorizado',4125506,
  'computadores','Criação de ficha sintética auditada');
 IF result->>'ok' IS DISTINCT FROM 'true' OR result->>'status'<>'pendente' THEN
  RAISE EXCEPTION 'Server did not confirm pending technician'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.technicians t WHERE t.id=(result->>'technician_id')::uuid
  AND t.user_id='00000000-0000-4000-8000-000000000006' AND
  t.city='São José dos Pinhais' AND t.state_uf='PR' AND
  t.specialties=ARRAY['computadores'] AND
  t.status='pendente' AND cardinality(t.coverage_city_ids)=0)
 THEN RAISE EXCEPTION 'Persisted technician not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log a
  WHERE a.id=(result->>'audit_id')::bigint AND a.actor_id='00000000-0000-4000-8000-000000000001'
  AND a.target_key=result->>'technician_id' AND a.action='technician_created'
  AND a.after_state->>'published'='false')
 THEN RAISE EXCEPTION 'Durable audit not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.eut_technician_private_contacts c
   WHERE c.user_id='00000000-0000-4000-8000-000000000006')
 THEN RAISE EXCEPTION 'Creation invented a contact'; END IF;
 rejected:=false;
 BEGIN PERFORM public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000006','Técnico QA Autorizado',4125506,
  'computadores','Criar ficha duplicada deve falhar');
 EXCEPTION WHEN SQLSTATE '23505' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Duplicate technician profile created'; END IF;
END $qa$;
RESET ROLE;

-- Complete edit RPC, already covered by original fixture test, now with newly
-- created (pending) real PostgreSQL row to prove create -> edit persistence.
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $qa$
DECLARE v_id uuid;v_time timestamptz;v_result jsonb;
BEGIN
 SELECT id,updated_at INTO v_id,v_time FROM public.technicians
 WHERE user_id='00000000-0000-4000-8000-000000000006';
 v_result:=public.eut_admin_technician_change(
  v_id,v_time,pg_catalog.jsonb_build_object(
   'base_city_ibge_id',4106902,'coverage_city_ids',pg_catalog.jsonb_build_array(),
   'radius_km',NULL,'neighborhood','Centro',
   'category_slugs',pg_catalog.jsonb_build_array('redes'),
   'service_slugs',pg_catalog.jsonb_build_array('wifi'),
   'phone_action','keep'),'Edição de cidade e serviço após criação');
 IF v_result->>'ok' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'Editing RPC failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.technicians t WHERE t.id=v_id AND
  t.city='Curitiba' AND t.specialties=ARRAY['redes'] AND
  t.service_slugs=ARRAY['wifi'] AND t.status='pendente') THEN
   RAISE EXCEPTION 'Edit not persisted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log a WHERE
  a.target_key=v_id::text AND a.action='technician_comprehensive_edit') THEN
   RAISE EXCEPTION 'Edit not audited'; END IF;
END $qa$;

-- Existing audit-failure fixture refuses reasons starting "Falha forçada".
-- The entire INSERT must be reverted, even when the audit rejects it.
DO $qa$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_admin_technician_create(
  '00000000-0000-4000-8000-000000000009','Técnico QA Reversível',
  4125506,'computadores','Falha forçada na auditoria da criação');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Missing audit error not reported'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians
  WHERE user_id='00000000-0000-4000-8000-000000000009') THEN
  RAISE EXCEPTION 'Row persisted despite failed audit'; END IF;
END $qa$;
\echo 'QA passed: real PostgreSQL creation, read-back, edit, role denial and atomic audit'
