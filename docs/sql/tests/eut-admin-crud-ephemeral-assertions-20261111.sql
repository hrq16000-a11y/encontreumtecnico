-- ONLY AFTER ephemeral schema and the proposed RPC SQL, in a clean CI Postgres.
-- Assertions raise SQL errors; CI must stop on the first failure.
\echo 'QA: unauthorized session denied'
SET ROLE anon;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $assert$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.eut_admin_technician_archive(
     '10000000-0000-4000-8000-000000000001',now(),'archive','Simulação anônima negada');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous execute not denied'; END IF;
END $assert$;
RESET ROLE;

\echo 'QA: client and unverified admin denied'
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $assert$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.eut_admin_technician_archive(
     '10000000-0000-4000-8000-000000000001',now(),'archive','Cliente não pode arquivar');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Client not denied'; END IF;
END $assert$;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000005';
DO $assert$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.eut_admin_technician_archive(
     '10000000-0000-4000-8000-000000000001',now(),'archive','Admin ainda não confirmado');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unverified admin not denied'; END IF;
END $assert$;

\echo 'QA: transaction; city trigger + IBGE + services + E.164 + audit'
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $assert$
DECLARE
  v_time timestamptz;
  v_result jsonb;
  v_stale timestamptz;
  v_count bigint;
  v_rejected boolean;
  v_payload jsonb:=pg_catalog.jsonb_build_object(
    'base_city_ibge_id',4106902,
    'coverage_city_ids',pg_catalog.jsonb_build_array(4106902,4125506),
    'radius_km',30,'neighborhood','Centro',
    'category_slugs',pg_catalog.jsonb_build_array('computadores','redes'),
    'service_slugs',pg_catalog.jsonb_build_array('manutencao-pc','wifi'),
    'phone_action','replace','phone_e164','+5541999994444','allow_paid_contact',true);
BEGIN
 SELECT updated_at INTO v_time FROM public.technicians WHERE id='10000000-0000-4000-8000-000000000001';
 v_result:=public.eut_admin_technician_change(
   '10000000-0000-4000-8000-000000000001',v_time,v_payload,
   'Alteração autorizada do perfil QA');
 IF v_result->>'ok' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Successful edit did not confirm server result'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.technicians t
   WHERE t.id='10000000-0000-4000-8000-000000000001'
     AND t.city='Curitiba' AND t.state_uf='PR'
     AND t.coverage_city_ids=ARRAY[4106902,4125506]
     AND t.service_slugs=ARRAY['manutencao-pc','wifi']
     AND t.service_radius_km=30) THEN
     RAISE EXCEPTION 'City/coverage/services were not updated together'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.eut_technician_private_contacts c
    WHERE c.user_id='00000000-0000-4000-8000-000000000003'
    AND c.phone_e164='+5541999994444' AND c.allow_paid_contact) THEN
    RAISE EXCEPTION 'Phone was not changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.eut_admin_management_log l
   WHERE l.action='technician_comprehensive_edit'
   AND l.after_state->>'phone_last4'='4444'
   AND l.before_state->>'city'='São José dos Pinhais') THEN
     RAISE EXCEPTION 'Atomic audit missing'; END IF;
 IF EXISTS (SELECT 1 FROM public.eut_admin_management_log l
   WHERE l.before_state::text LIKE '%+554199999%'
      OR l.after_state::text LIKE '%+554199999%') THEN
     RAISE EXCEPTION 'Full phone leaked in audit'; END IF;

 -- Same optimistic version cannot overwrite a newer edit.
 v_rejected:=false;
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000001',v_time,v_payload,
     'Tentativa concorrente rejeitada');
 EXCEPTION WHEN SQLSTATE '40001' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Stale version accepted'; END IF;

 -- Inactive service gets rejected even with a valid admin session.
 SELECT updated_at INTO v_stale FROM public.technicians
   WHERE id='10000000-0000-4000-8000-000000000001';
 v_rejected:=false;
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000001',v_stale,
     v_payload || '{"service_slugs":["inativo"]}'::jsonb,
     'Serviço inválido recusado pelo servidor');
 EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Inactive service accepted'; END IF;

 -- Existing phone belongs to another technician: no takeover.
 v_rejected:=false;
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000001',v_stale,
     v_payload || '{"phone_e164":"+5541999990002"}'::jsonb,
     'Telefone duplicado recusado no servidor');
 EXCEPTION WHEN SQLSTATE '23505' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Duplicate phone accepted'; END IF;

 -- A blocked destination number cannot be attached, regardless of consent.
 INSERT INTO eut_moderation.blocked_phones(phone_digits,reason_internal)
   VALUES('5541999997777','Bloqueio sintético de número');
 v_rejected:=false;
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000001',v_stale,
     v_payload || '{"phone_e164":"+5541999997777","allow_paid_contact":false}'::jsonb,
     'Número bloqueado recusado no servidor');
 EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Blocked destination phone accepted'; END IF;

 -- Refuse unknown payload keys and official-looking but absent city codes.
 v_rejected:=false;
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000001',v_stale,
     v_payload || '{"unreviewed_flag":true}'::jsonb,
     'Campo não auditado recusado pelo servidor');
 EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Unknown payload key accepted'; END IF;
 v_rejected:=false;
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000001',v_stale,
     v_payload || '{"base_city_ibge_id":9999999}'::jsonb,
     'Município inexistente recusado pelo servidor');
 EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true; END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Unknown municipality accepted'; END IF;
END $assert$;

\echo 'QA: audit failure rolls back city, phone and version'
CREATE OR REPLACE FUNCTION public.fixture_fail_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.reason LIKE 'Falha forçada%' THEN
   RAISE EXCEPTION 'Simulated audit failure' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_audit_fail BEFORE INSERT ON public.eut_admin_management_log
FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_audit();
\echo 'QA: archive audit failure also rolls back public status and private consent'
DO $assert$
DECLARE
  original public.technicians%ROWTYPE;
  original_consent boolean;
  rejected boolean:=false;
BEGIN
  SELECT * INTO original FROM public.technicians
    WHERE id='10000000-0000-4000-8000-000000000002';
  SELECT allow_paid_contact INTO original_consent
    FROM public.eut_technician_private_contacts WHERE user_id=original.user_id;
  BEGIN
    PERFORM public.eut_admin_technician_archive(original.id,original.updated_at,'archive',
      'Falha forçada ao arquivar técnico sintético');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Archive audit failure did not roll back'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.technicians
    WHERE id=original.id AND updated_at=original.updated_at AND status=original.status)
    OR EXISTS(SELECT 1 FROM eut_moderation.archived_technicians
      WHERE technician_id=original.id)
    OR NOT EXISTS(SELECT 1 FROM public.eut_technician_private_contacts
      WHERE user_id=original.user_id AND allow_paid_contact=original_consent)
  THEN RAISE EXCEPTION 'Archive transaction partially committed after failed audit'; END IF;
END $assert$;
DO $assert$
DECLARE
  original public.technicians%ROWTYPE;
  original_phone text;
  rejected boolean:=false;
BEGIN
  SELECT * INTO original FROM public.technicians
    WHERE id='10000000-0000-4000-8000-000000000001';
  SELECT phone_e164 INTO original_phone FROM public.eut_technician_private_contacts
    WHERE user_id=original.user_id;
  BEGIN
    PERFORM public.eut_admin_technician_change(original.id,original.updated_at,
      pg_catalog.jsonb_build_object(
        'base_city_ibge_id',4125506,
        'coverage_city_ids',pg_catalog.jsonb_build_array(4125506),
        'radius_km',20,'neighborhood','Centro',
        'category_slugs',pg_catalog.jsonb_build_array('computadores'),
        'service_slugs',pg_catalog.jsonb_build_array('manutencao-pc'),
        'phone_action','replace','phone_e164','+5541999995555',
        'allow_paid_contact',true),
      'Falha forçada na auditoria transacional');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Audit failure did not roll back'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.technicians
    WHERE id=original.id AND updated_at=original.updated_at
      AND city=original.city AND coverage_city_ids=original.coverage_city_ids) THEN
    RAISE EXCEPTION 'Technician was modified after audit failure'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.eut_technician_private_contacts
    WHERE user_id=original.user_id AND phone_e164=original_phone) THEN
    RAISE EXCEPTION 'Phone changed without audit'; END IF;
END $assert$;

\echo 'QA: ban persists across archive/restore, contact disabled, never republish'
INSERT INTO eut_moderation.blocked_accounts(user_id,reason_internal)
  VALUES('00000000-0000-4000-8000-000000000003','Bloqueio sintético QA');
DO $assert$
DECLARE
  v_time timestamptz; v_result jsonb; rejected boolean:=false;
  v_payload jsonb:=pg_catalog.jsonb_build_object(
    'base_city_ibge_id',4106902,
    'coverage_city_ids',pg_catalog.jsonb_build_array(4106902,4125506),
    'radius_km',30,'category_slugs',pg_catalog.jsonb_build_array('computadores','redes'),
    'service_slugs',pg_catalog.jsonb_build_array('manutencao-pc','wifi'),
    'phone_action','replace','phone_e164','+5541999996666','allow_paid_contact',true);
BEGIN
  SELECT updated_at INTO v_time FROM public.technicians
    WHERE id='10000000-0000-4000-8000-000000000001';
  BEGIN
    PERFORM public.eut_admin_technician_change(
      '10000000-0000-4000-8000-000000000001',v_time,v_payload,
      'Troca proibida em conta bloqueada');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Blocked contact changed'; END IF;

  v_result:=public.eut_admin_technician_archive(
     '10000000-0000-4000-8000-000000000001',v_time,'archive',
     'Arquivo reversível com bloqueio preservado');
  IF v_result->>'archived'<>'true' OR
    EXISTS(SELECT 1 FROM public.eut_technician_private_contacts
      WHERE user_id='00000000-0000-4000-8000-000000000003'
        AND allow_paid_contact) OR
    NOT EXISTS(SELECT 1 FROM eut_moderation.archived_technicians
      WHERE technician_id='10000000-0000-4000-8000-000000000001'
        AND restored_at IS NULL) THEN
    RAISE EXCEPTION 'Archive did not suspend contact or mark archive'; END IF;

  SELECT updated_at INTO v_time FROM public.technicians
    WHERE id='10000000-0000-4000-8000-000000000001';
  v_result:=public.eut_admin_technician_archive(
    '10000000-0000-4000-8000-000000000001',v_time,'restore',
    'Retorno apenas para revisão sem desbanir');
  IF v_result->>'status'<>'pendente' OR
    NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts
      WHERE user_id='00000000-0000-4000-8000-000000000003') OR
    EXISTS(SELECT 1 FROM public.eut_technician_private_contacts
      WHERE user_id='00000000-0000-4000-8000-000000000003' AND allow_paid_contact) OR
    NOT EXISTS(SELECT 1 FROM eut_moderation.archived_technicians
      WHERE technician_id='10000000-0000-4000-8000-000000000001'
        AND restored_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Restore incorrectly approved/unbanned/shared contact'; END IF;
END $assert$;

\echo 'QA passed: isolated PostgreSQL transaction, authorization and security tests'

\echo 'QA: true PostgreSQL authenticated role can execute audited RPC, client cannot'
SELECT updated_at AS qa_b_version FROM public.technicians
 WHERE id='10000000-0000-4000-8000-000000000002' \gset
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $assert$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.eut_admin_technician_change(
     '10000000-0000-4000-8000-000000000002',now(),'{}'::jsonb,
     'Cliente não pode alterar campos');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Authenticated client was able to edit'; END IF;
END $assert$;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT public.eut_admin_technician_archive(
  '10000000-0000-4000-8000-000000000002',
  :'qa_b_version'::timestamptz,'archive',
  'Arquivo sintético pelo papel real autenticado'
) AS authenticated_rpc_result;
RESET ROLE;
DO $assert$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.technicians t
   JOIN eut_moderation.archived_technicians a ON a.technician_id=t.id
   WHERE t.id='10000000-0000-4000-8000-000000000002'
     AND t.status='suspenso' AND a.restored_at IS NULL)
 THEN RAISE EXCEPTION 'Real authenticated SQL role did not archive'; END IF;
END $assert$;
\echo 'QA passed: authenticated role access verified independently of superuser test role'

\echo 'QA: keeping and removing a private phone preserves bans and audits only its suffix'
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $assert$
DECLARE
  v_time timestamptz;
  v_result jsonb;
  v_payload jsonb:=pg_catalog.jsonb_build_object(
    'base_city_ibge_id',4106902,
    'coverage_city_ids',pg_catalog.jsonb_build_array(),
    'radius_km',null,'neighborhood','Centro',
    'category_slugs',pg_catalog.jsonb_build_array('computadores'),
    'service_slugs',pg_catalog.jsonb_build_array('manutencao-pc'),
    'phone_action','keep');
BEGIN
  -- Synthetic technician A was restored to pending above and remains account-blocked.
  SELECT updated_at INTO v_time FROM public.technicians
    WHERE id='10000000-0000-4000-8000-000000000001';
  v_result:=public.eut_admin_technician_change(
    '10000000-0000-4000-8000-000000000001',v_time,v_payload,
    'Manter contato privado durante revisão sintética');
  IF v_result->>'phone_changed' IS DISTINCT FROM 'false' OR NOT EXISTS(
    SELECT 1 FROM public.eut_technician_private_contacts
     WHERE user_id='00000000-0000-4000-8000-000000000003'
       AND phone_e164='+5541999994444' AND allow_paid_contact=false) THEN
    RAISE EXCEPTION 'Keep operation unexpectedly modified private contact'; END IF;

  SELECT updated_at INTO v_time FROM public.technicians
    WHERE id='10000000-0000-4000-8000-000000000001';
  v_result:=public.eut_admin_technician_change(
    '10000000-0000-4000-8000-000000000001',v_time,
    v_payload || '{"phone_action":"remove"}'::jsonb,
    'Remover contato privado sem remover bloqueio');
  IF v_result->>'phone_changed' IS DISTINCT FROM 'true'
    OR EXISTS(SELECT 1 FROM public.eut_technician_private_contacts
      WHERE user_id='00000000-0000-4000-8000-000000000003')
    OR NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts
      WHERE user_id='00000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'Remove contact did not preserve account ban'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log l
      WHERE l.action='technician_comprehensive_edit'
        AND l.reason='Remover contato privado sem remover bloqueio'
        AND l.before_state->>'phone_last4'='4444'
        AND l.after_state->>'phone_last4' IS NULL)
    OR EXISTS(SELECT 1 FROM public.eut_admin_management_log l
      WHERE l.before_state::text LIKE '%+5541999994444%'
         OR l.after_state::text LIKE '%+5541999994444%') THEN
    RAISE EXCEPTION 'Private contact audit missing, or full phone leaked'; END IF;
END $assert$;

\echo 'QA passed: keep/remove phone, private audit and ban preservation'

\echo 'QA: independent technician registry (no synthetic Auth users)'
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $assert_registry$
DECLARE
  v_payload jsonb:=pg_catalog.jsonb_build_object(
    'display_name','Técnico Manual QA',
    'city_ibge_id',NULL,'ddd','41','region_approx','Região aproximada PR',
    'category_slugs',pg_catalog.jsonb_build_array('computadores'),
    'service_slugs',pg_catalog.jsonb_build_array('manutencao-pc'),
    'admin_active',true,'is_demo',false,
    'phone_action','replace','phone_e164','+5541999988800',
    'contact_suspended',false);
  v_id uuid;
  v_version timestamptz;
  v_created jsonb;
  v_next jsonb;
  v_rejected boolean;
  v_accounts integer;
  v_portal integer;
  v_audits integer;
BEGIN
  SELECT count(*) INTO v_accounts FROM auth.users;
  SELECT count(*) INTO v_portal FROM public.technicians;
  v_created:=public.eut_admin_technician_record_save('manual','qa-manual-0001',NULL,
    v_payload,'Cadastro manual sintético com DDD aproximado');
  v_id:=(v_created->>'technician_id')::uuid;
  v_version:=(v_created->>'updated_at')::timestamptz;
  IF v_created->>'created'<>'true' OR v_id IS NULL OR
     EXISTS(SELECT 1 FROM eut_moderation.admin_technician_records r
       WHERE r.id=v_id AND r.city_ibge_id IS NOT NULL) OR
     (SELECT count(*) FROM auth.users)<>v_accounts OR
     (SELECT count(*) FROM public.technicians)<>v_portal THEN
    RAISE EXCEPTION 'Manual creation mutated Auth/portal or fabricated city'; END IF;
  SELECT count(*) INTO v_audits FROM public.eut_admin_management_log
    WHERE target_key=v_id::text;
  v_next:=public.eut_admin_technician_record_save('manual','qa-manual-0001',NULL,
    v_payload || '{"display_name":"Tentativa de sobrescrita"}'::jsonb,
    'Reimportação idempotente de mesmo identificador');
  IF v_next->>'idempotent'<>'true' OR v_next->>'created'<>'false' OR
    (SELECT count(*) FROM public.eut_admin_management_log
       WHERE target_key=v_id::text)<>v_audits OR
    NOT EXISTS (SELECT 1 FROM eut_moderation.admin_technician_records r
      WHERE r.id=v_id AND r.display_name='Técnico Manual QA') THEN
    RAISE EXCEPTION 'Import retry overwrote existing record'; END IF;
  v_next:=public.eut_admin_technician_record_save('manual','qa-manual-0001',v_version,
    v_payload || '{"display_name":"Técnico Manual Atualizado"}'::jsonb,
    'Correção sintética de nome com revisão otimista');
  IF v_next->>'created'<>'false' OR NOT EXISTS(
    SELECT 1 FROM eut_moderation.admin_technician_records r
      WHERE r.id=v_id AND r.display_name='Técnico Manual Atualizado') THEN
    RAISE EXCEPTION 'Name edit failed'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_admin_technician_record_save('manual','qa-manual-0001',
      v_version,v_payload,'Atualização concorrente sintética recusada');
  EXCEPTION WHEN SQLSTATE '40001' THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Stale registry version accepted'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_admin_technician_record_save('manual','qa-block-0001',NULL,
      v_payload || '{"phone_e164":"+5541999997777"}'::jsonb,
      'Número bloqueado sintético recusado');
  EXCEPTION WHEN SQLSTATE '23505' THEN v_rejected:=true; END;
  IF NOT v_rejected OR EXISTS(SELECT 1 FROM eut_moderation.admin_technician_records
    WHERE source_id='qa-block-0001') THEN RAISE EXCEPTION 'Banned phone accepted'; END IF;
  IF EXISTS(SELECT 1 FROM public.eut_admin_management_log l
    WHERE l.target_key=v_id::text AND
      (l.before_state::text LIKE '%+5541999988800%'
       OR l.after_state::text LIKE '%+5541999988800%')) THEN
    RAISE EXCEPTION 'Full contact leaked to audit'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.eut_admin_technician_registry_list('',50,0) x
    WHERE x.technician_id=v_id AND x.contact_last4='8800' AND x.city_ibge_id IS NULL)
  THEN RAISE EXCEPTION 'Admin registry listing incomplete'; END IF;
  v_version:=(SELECT r.updated_at FROM eut_moderation.admin_technician_records r
    WHERE r.id=v_id);
  v_next:=public.eut_admin_technician_record_archive(v_id,v_version,'archive',
    'Homologação sintética de arquivamento ativo');
  IF v_next->>'archived'<>'true' OR v_next->>'admin_active'<>'false'
  THEN RAISE EXCEPTION 'Archive did not deactivate active record'; END IF;
  v_version:=(v_next->>'updated_at')::timestamptz;
  v_next:=public.eut_admin_technician_record_archive(v_id,v_version,'restore',
    'Homologação sintética de restauração ativa');
  IF v_next->>'archived'<>'false' OR v_next->>'admin_active'<>'true' OR
    NOT EXISTS(SELECT 1 FROM eut_moderation.admin_technician_records r
      WHERE r.id=v_id AND r.archived_at IS NULL AND r.admin_active=true) OR
    NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log l
      WHERE l.target_key=v_id::text AND l.action='registry_technician_restored'
        AND l.after_state->>'admin_active'='true'
        AND length(coalesce(l.reason,''))>=8)
  THEN RAISE EXCEPTION 'Restore lost prior active state or audit'; END IF;
END $assert_registry$;

\echo 'QA: imported evidence, protected demos and contact suspension'
DO $assert_registry$
DECLARE
  v_payload jsonb:=pg_catalog.jsonb_build_object(
    'display_name','Técnico Histórico QA','city_ibge_id',NULL,
    'ddd',NULL,'region_approx',NULL,
    'category_slugs',pg_catalog.jsonb_build_array(),
    'service_slugs',pg_catalog.jsonb_build_array(),
    'admin_active',false,'is_demo',false,'phone_action','keep');
  v_id uuid;
  v_version timestamptz;
  v_result jsonb;
  v_rejected boolean;
BEGIN
  v_result:=public.eut_admin_technician_record_save('wordpress',
    'wordpress_20261108:1001',NULL,v_payload,
    'Importação sintética de candidato comprovado');
  IF v_result->>'created'<>'true' THEN RAISE EXCEPTION 'Verified legacy record failed'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_admin_technician_record_save('wordpress',
      'wordpress_20261108:1001',NULL,
      v_payload || '{"admin_active":true}'::jsonb,
      'Importação não deve ativar em lote');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Import activated imported record'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_admin_technician_record_save('wordpress',
      'wordpress_20261108:1002',NULL,v_payload,
      'Demonstração não pode ser ativada pela importação');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Demo import bypassed source evidence'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_admin_technician_record_save('wordpress',
      'wordpress_20261108:1003',NULL,v_payload,
      'Empregador não deve ser técnico por inferência');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Employer silently converted'; END IF;
  v_result:=public.eut_admin_technician_record_save('wordpress',
    'wordpress_20261108:1002',NULL,
    v_payload || '{"is_demo":true,"admin_active":false}'::jsonb,
    'Preservação de demonstração sintética arquivável');
  IF v_result->>'created'<>'true' THEN RAISE EXCEPTION 'Protected demo not retained'; END IF;

  v_result:=public.eut_admin_technician_record_save('manual','qa-hold-0001',NULL,
    v_payload || pg_catalog.jsonb_build_object(
      'phone_action','replace','phone_e164','+5541999988811',
      'contact_suspended',true),
    'Contato sintético explicitamente suspenso');
  v_id:=(v_result->>'technician_id')::uuid;
  v_version:=(v_result->>'updated_at')::timestamptz;
  FOR v_result IN SELECT jsonb_build_object('phone_action','replace',
      'phone_e164','+5541999988812','contact_suspended',false)
    UNION ALL SELECT jsonb_build_object('phone_action','remove') LOOP
    v_rejected:=false;
    BEGIN
      PERFORM public.eut_admin_technician_record_save('manual','qa-hold-0001',v_version,
        v_payload || v_result,
        'Suspensão de contato não pode ser contornada');
    EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'Suspended contact bypassed'; END IF;
  END LOOP;
  v_result:=public.eut_admin_technician_record_archive(v_id,v_version,'archive',
    'Arquivar técnico sintético sem liberar contato');
  IF v_result->>'archived'<>'true' THEN RAISE EXCEPTION 'Archive failed'; END IF;
  v_version:=(v_result->>'updated_at')::timestamptz;
  v_result:=public.eut_admin_technician_record_archive(v_id,v_version,'restore',
    'Restaurar técnico sintético sem reativar contato');
  IF v_result->>'admin_active'<>'false' OR NOT EXISTS (
    SELECT 1 FROM eut_moderation.admin_technician_record_contacts c
      WHERE c.record_id=v_id AND c.contact_suspended=true
        AND c.phone_e164='+5541999988811')
  THEN RAISE EXCEPTION 'Restore bypassed contact restriction'; END IF;
END $assert_registry$;

\echo 'QA: RLS and rollback for private registry'
DO $assert_registry$
BEGIN
  IF pg_catalog.has_function_privilege('anon',
     'public.eut_admin_technician_record_save(text,text,timestamptz,jsonb,text)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
      'public.eut_admin_technician_registry_list(text,integer,integer)','EXECUTE')
    OR pg_catalog.has_table_privilege('authenticated',
      'eut_moderation.admin_technician_record_contacts','SELECT')
  THEN RAISE EXCEPTION 'Private registry exposed via grants'; END IF;
END $assert_registry$;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $assert_registry$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.eut_admin_technician_registry_list();
  EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Client listed admin registry'; END IF;
END $assert_registry$;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

CREATE OR REPLACE FUNCTION public.fixture_deny_registry_audit()
RETURNS trigger LANGUAGE plpgsql AS $fixture$
BEGIN
  IF NEW.reason='Rollback sintético exige transação integral' THEN
    RAISE EXCEPTION 'Synthetic audit failure'; END IF;
  RETURN NEW;
END $fixture$;
CREATE TRIGGER fixture_registry_audit_failure BEFORE INSERT
  ON public.eut_admin_management_log FOR EACH ROW
  EXECUTE FUNCTION public.fixture_deny_registry_audit();
DO $assert_registry$
DECLARE v_failed boolean:=false;
BEGIN
  BEGIN
    PERFORM public.eut_admin_technician_record_save('manual','qa-rollback-0001',NULL,
      pg_catalog.jsonb_build_object(
        'display_name','Técnico Falha QA','city_ibge_id',NULL,'ddd','41',
        'region_approx',NULL,'category_slugs',pg_catalog.jsonb_build_array(),
        'service_slugs',pg_catalog.jsonb_build_array(),'admin_active',true,
        'is_demo',false,'phone_action','replace',
        'phone_e164','+5541999988899','contact_suspended',false),
      'Rollback sintético exige transação integral');
  EXCEPTION WHEN OTHERS THEN v_failed:=true; END;
  IF NOT v_failed OR EXISTS (
    SELECT 1 FROM eut_moderation.admin_technician_records
      WHERE source_id='qa-rollback-0001') OR EXISTS (
    SELECT 1 FROM eut_moderation.admin_technician_record_contacts
      WHERE phone_e164='+5541999988899') THEN
    RAISE EXCEPTION 'Audit failure failed to roll back registry and contact'; END IF;
END $assert_registry$;
DROP TRIGGER fixture_registry_audit_failure ON public.eut_admin_management_log;
DROP FUNCTION public.fixture_deny_registry_audit();
\echo 'QA passed: registry create/edit/import, RBAC, contact protection and rollback'
