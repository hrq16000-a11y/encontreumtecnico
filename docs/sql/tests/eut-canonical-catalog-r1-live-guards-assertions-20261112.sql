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
\echo 'QA passed: quality, city, services, public text, bans and restrictive RLS'
