-- Somente fixtures efêmeras no PostgreSQL descartável do CI; nenhuma fixture é real.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('eut.fixture.role','tecnico',true);
DO $$
DECLARE t uuid:='10000000-0000-4000-8000-000000000001';
 d jsonb:=jsonb_build_object('equipment',ARRAY['notebook','tools'],
 'transport_mode','car','can_travel',true,'service_windows',ARRAY['business','holiday'],
 'eta_business_minutes',90,'eta_outside_minutes',null,'free_city_ids',ARRAY[4106902],
 'paid_city_ids',ARRAY[4125506],'free_km',10,'km_threshold',50,
 'km_rate_cents',250,'km_rate_after_cents',350);
 v jsonb; ts timestamptz; rejected boolean;
BEGIN
 v:=public.eut_technician_operations_get(t);
 IF v->>'ok'<>'true' OR v->'profile'<>'null'::jsonb THEN RAISE EXCEPTION 'initial get'; END IF;
 v:=public.eut_technician_operations_save(t,d,NULL,NULL);
 IF v->>'ok'<>'true' THEN RAISE EXCEPTION 'save'; END IF;
 ts:=(v->>'updated_at')::timestamptz;
 v:=public.eut_technician_operations_get(t);
 IF (v->'profile'->>'km_rate_cents')::integer<>250 OR (v->>'updated_at')::timestamptz<>ts
 THEN RAISE EXCEPTION 're-read'; END IF;
 rejected:=false;
 BEGIN PERFORM public.eut_technician_operations_save(t,d,NULL,NULL);
 EXCEPTION WHEN serialization_failure THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'optimistic conflict accepted'; END IF;
 rejected:=false;
 BEGIN PERFORM public.eut_technician_operations_save(t,d||'{"phone":"private"}'::jsonb,ts,NULL);
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'extra field accepted'; END IF;
 rejected:=false;
 BEGIN PERFORM public.eut_technician_operations_save(t,d||'{"paid_city_ids":[3550308]}'::jsonb,ts,NULL);
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'out-of-coverage municipality accepted'; END IF;
 rejected:=false;
 BEGIN PERFORM public.eut_technician_operations_save(
 '10000000-0000-4000-8000-000000000002',d,NULL,NULL);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'suspended other owner accepted'; END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE v jsonb; rejected boolean:=false;
BEGIN
 v:=public.eut_public_technician_operations('10000000-0000-4000-8000-000000000001');
 IF v IS NULL OR v ? 'phone' OR v ? 'user_id' OR v ? 'status' THEN RAISE EXCEPTION 'public projection invalid'; END IF;
 IF public.eut_public_technician_operations('10000000-0000-4000-8000-000000000002') IS NOT NULL OR
    public.eut_public_technician_operations('10000000-0000-4000-8000-000000000003') IS NOT NULL
 THEN RAISE EXCEPTION 'suspended public leak'; END IF;
 BEGIN PERFORM public.eut_technician_operations_get('10000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'anonymous private get accepted'; END IF;
 IF has_table_privilege('anon','eut_profile_ops.technician_operations','SELECT') OR
    has_table_privilege('authenticated','eut_profile_ops.technician_operations','INSERT')
 THEN RAISE EXCEPTION 'direct table privilege'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
SELECT set_config('eut.fixture.role','admin',true);
DO $$
DECLARE t uuid:='10000000-0000-4000-8000-000000000001';
 d jsonb:=jsonb_build_object('equipment',ARRAY['multimeter'],
 'transport_mode','motorcycle','can_travel',false,'service_windows',ARRAY['weekend'],
 'eta_business_minutes',null,'eta_outside_minutes',60,'free_city_ids',ARRAY[4106902],
 'paid_city_ids',ARRAY[]::integer[],'free_km',0,'km_threshold',null,
 'km_rate_cents',null,'km_rate_after_cents',null);
 v jsonb; rejected boolean:=false;
BEGIN
 BEGIN PERFORM public.eut_technician_operations_save(t,d,NULL,'');
 EXCEPTION WHEN invalid_parameter_value THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'admin without reason accepted'; END IF;
 v:=public.eut_technician_operations_get(t);
 v:=public.eut_technician_operations_save(t,d,(v->>'updated_at')::timestamptz,
   'Edição administrativa autorizada para QA');
 IF v->>'ok'<>'true' THEN RAISE EXCEPTION 'admin save'; END IF;
END $$;
COMMIT;

-- Nenhuma ação de teste alterou a tabela canônica nem os dois suspensos.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.technicians WHERE status='suspenso')<>2 OR
    (SELECT count(*) FROM eut_profile_ops.technician_operations)<>1 OR
    (SELECT count(*) FROM public.eut_admin_management_log WHERE action='technician_operations_self_updated')<>1 OR
    (SELECT count(*) FROM public.eut_admin_management_log WHERE action='technician_operations_admin_updated')<>1
 THEN RAISE EXCEPTION 'fixture mutated'; END IF;
END $$;
