\echo 'Live guard QA: public contact wording is rejected by the RPC'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.eut_admin_catalog_upsert(
     'admin_manual','manual:unsafe-label','Contato pelo WhatsApp',
     NULL,NULL,'(41) 99999-3030','Recusar divulgação de contato público');
 EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'RPC accepted public WhatsApp text'; END IF;
 IF EXISTS(SELECT 1 FROM eut_moderation.catalog_provenance
   WHERE source_key='manual:unsafe-label') THEN
   RAISE EXCEPTION 'Forbidden public label persisted'; END IF;
END $t$;

-- ONLY disposable PostgreSQL. Run after canonical R1 original assertions.
\echo 'Live guard QA: a complete legacy Auth technician remains public'
INSERT INTO auth.users(id,email_confirmed_at)
 VALUES('00000000-0000-4000-8000-000000000006',now());
INSERT INTO public.profiles(id) VALUES('00000000-0000-4000-8000-000000000006');
INSERT INTO public.user_roles(user_id,role)
 VALUES('00000000-0000-4000-8000-000000000006','tecnico');
INSERT INTO public.technicians (
 id,user_id,display_name,city,state_uf,specialties,service_slugs,
 coverage_city_ids,service_radius_km,status
) VALUES (
 '10000000-0000-4000-8000-000000000006',
 '00000000-0000-4000-8000-000000000006',
 'Técnico íntegro QA','Curitiba','PR',
 ARRAY['computadores'],ARRAY['manutencao-pc'],ARRAY[4106902],10,'aprovado'
);

\echo 'Live guards QA: privacy, quality, services, municipality and legacy bans'
DO $t$
DECLARE denied boolean; v_id uuid:='10000000-0000-4000-8000-000000000006';
BEGIN
 denied:=false;
 BEGIN UPDATE public.technicians SET bio='WhatsApp 41 99999-8080' WHERE id=v_id;
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Phone accepted in public bio'; END IF;
 denied:=false;
 BEGIN UPDATE public.technicians SET display_name='contato@exemplo.com.br' WHERE id=v_id;
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Email accepted in public name'; END IF;
 denied:=false;
 BEGIN UPDATE public.technicians SET service_slugs=ARRAY['wifi'] WHERE id=v_id;
 EXCEPTION WHEN SQLSTATE '23514' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unrelated category service accepted'; END IF;
 denied:=false;
 BEGIN UPDATE public.technicians SET city='Cidade Fantasia',state_uf='PR' WHERE id=v_id;
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Invented municipality accepted'; END IF;
 denied:=false;
 BEGIN UPDATE public.technicians SET coverage_city_ids=ARRAY[9999999] WHERE id=v_id;
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid IBGE coverage accepted'; END IF;
 denied:=false;
 BEGIN UPDATE public.technicians SET status='aprovado'
 WHERE user_id='00000000-0000-4000-8000-000000000003';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Blocked Auth account republished'; END IF;
 UPDATE public.technicians SET city='são josé dos pinhais' WHERE id=v_id;
 IF NOT EXISTS(SELECT 1 FROM public.technicians WHERE id=v_id
 AND city='São José dos Pinhais' AND cardinality(coverage_city_ids)=0
 AND service_radius_km IS NULL)
 THEN RAISE EXCEPTION 'Real city trigger did not reset coverage'; END IF;
END $t$;

\echo 'Live RLS QA: preserve legit public row, hide disabled and imported'
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policy
  WHERE polrelid='public.technicians'::regclass
  AND polname='eut_catalog_direct_insert_requires_owner' AND NOT polpermissive)
 THEN RAISE EXCEPTION 'Restrictive INSERT policy absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy
  WHERE polrelid='public.technicians'::regclass
  AND polname='Public reads approved'
  AND pg_get_expr(polqual,polrelid) LIKE '%catalog_enabled%')
 THEN RAISE EXCEPTION 'Public approved policy ignores catalog_enabled'; END IF;
END $t$;
SET request.jwt.claim.sub='';
SET ROLE anon;
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.technicians
   WHERE id='10000000-0000-4000-8000-000000000006')
 THEN RAISE EXCEPTION 'Eligible existing technician invisible'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians WHERE user_id IS NULL)
 THEN RAISE EXCEPTION 'Pending Auth-less imports exposed to anon'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians
   WHERE user_id='00000000-0000-4000-8000-000000000003')
 THEN RAISE EXCEPTION 'Banned legacy profile visible via permissive OR'; END IF;
END $t$;
RESET ROLE;

\echo 'Live RLS QA: clients cannot directly INSERT unclaimed technicians'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SET ROLE authenticated;
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   INSERT INTO public.technicians(id,user_id,display_name,city,status)
   VALUES('10000000-0000-4000-8000-000000000099',NULL,'Ficha irregular',NULL,'pendente');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Client bypassed admin RPC for Auth-less INSERT'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians WHERE user_id IS NULL)
 THEN RAISE EXCEPTION 'Client can SELECT unclaimed profile'; END IF;
END $t$;
RESET ROLE;

\echo 'Live RLS QA: admin sees unclaimed but must use audited RPC for create'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET ROLE authenticated;
DO $t$
DECLARE denied boolean:=false; result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.technicians WHERE user_id IS NULL)
 THEN RAISE EXCEPTION 'Admin lost access to unclaimed profile'; END IF;
 BEGIN
   INSERT INTO public.technicians(id,user_id,display_name,city,status)
   VALUES('10000000-0000-4000-8000-000000000098',NULL,'Sem auditoria',NULL,'pendente');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Admin inserted Auth-less outside audit RPC'; END IF;
 result:=public.eut_admin_catalog_upsert(
  'admin_manual','manual:auth-rpc-check',NULL,NULL,NULL,'(41) 99999-4040',
  'Cadastro autorizado por RPC auditada');
 IF result->>'ok'<>'true' OR result->>'created'<>'true'
 THEN RAISE EXCEPTION 'Admin RPC failed with real RLS'; END IF;
END $t$;
RESET ROLE;
\echo 'Live trigger QA: complete deployed 9+1 event inventory'
DO $t$
DECLARE n integer; v_slug text;
BEGIN
 SELECT count(*) INTO n FROM pg_trigger
 WHERE tgrelid='public.technicians'::regclass AND NOT tgisinternal;
 IF n<>10 THEN RAISE EXCEPTION 'Expected 9 live + 1 new audit trigger; got %',n; END IF;
 SELECT count(*) INTO n FROM pg_trigger
 WHERE tgrelid='public.eut_technician_private_contacts'::regclass AND NOT tgisinternal;
 IF n<>1 THEN RAISE EXCEPTION 'Deployed private phone trigger missing'; END IF;
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('technicians','eut_admin_management_log');
 IF n<>11 THEN RAISE EXCEPTION 'Expected 10 deployed + 1 new restrictive policy; got %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians t JOIN public.qa_r1_legacy_versions v
     ON t.id=v.id WHERE t.updated_at IS DISTINCT FROM v.updated_at
       OR t.catalog_enabled IS NOT NULL) THEN
   RAISE EXCEPTION 'Legacy timestamps or nullable flag modified'; END IF;
 SELECT public_slug INTO v_slug FROM public.technicians
 WHERE id='10000000-0000-4000-8000-000000000006';
 IF v_slug IS NULL THEN RAISE EXCEPTION 'Deployed public slug trigger not active'; END IF;
END $t$;

\echo 'Live trigger QA: bronze, admin audit and restricted private contact'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
INSERT INTO eut_pioneers.pre_registrations
 (linked_auth_user_id,claim_state,verified_at,bronze_eligible)
 VALUES('00000000-0000-4000-8000-000000000006','vinculado',now(),true);
UPDATE public.technicians SET status='aprovado'
 WHERE id='10000000-0000-4000-8000-000000000006';
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.eut_pioneer_badges
     WHERE technician_id='10000000-0000-4000-8000-000000000006')
 THEN RAISE EXCEPTION 'Pioneer bronze trigger did not run'; END IF;
END $t$;
UPDATE public.technicians SET bio='Apresentação profissional sem contato'
 WHERE id='10000000-0000-4000-8000-000000000006';
DO $t$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.eut_admin_management_log
  WHERE target_key='10000000-0000-4000-8000-000000000006'
    AND action='technician_update') THEN
   RAISE EXCEPTION 'Deployed audit trigger did not run'; END IF;
END $t$;
INSERT INTO eut_moderation.blocked_phones(phone_digits,reason_internal)
 VALUES('5541999994444','Bloqueio de teste sintético');
DO $t$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.eut_technician_private_contacts(
     user_id,phone_e164,allow_paid_contact)
  VALUES('00000000-0000-4000-8000-000000000006','+5541999994444',false);
 EXCEPTION WHEN SQLSTATE 'P0001' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Real private contact trigger not enforcing ban'; END IF;
END $t$;
\echo 'QA passed: 9 real technician triggers, 1 private trigger and 10 deployed RLS plus restrictive insert guard'
