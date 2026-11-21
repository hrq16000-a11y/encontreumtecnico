-- PROPOSTA NÃO APLICADA: contrato operacional técnico v1.
-- Revisar preflight/rollback, executar QA PostgreSQL isolado e exigir autorização
-- específica antes de qualquer alteração no Supabase EUT oficial.
-- Não toca preços de acesso ao contato, status, RLS existentes ou telefones.

BEGIN;
CREATE SCHEMA IF NOT EXISTS eut_profile_ops;

CREATE TABLE eut_profile_ops.technician_operations (
  technician_id uuid PRIMARY KEY REFERENCES public.technicians(id) ON DELETE CASCADE,
  equipment text[] NOT NULL DEFAULT '{}'::text[],
  transport_mode text,
  can_travel boolean NOT NULL DEFAULT false,
  service_windows text[] NOT NULL DEFAULT '{}'::text[],
  eta_business_minutes integer,
  eta_outside_minutes integer,
  free_city_ids integer[] NOT NULL DEFAULT '{}'::integer[],
  paid_city_ids integer[] NOT NULL DEFAULT '{}'::integer[],
  free_km integer,
  km_threshold integer,
  km_rate_cents integer,
  km_rate_after_cents integer,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT equipment_enum CHECK (equipment <@ ARRAY[
    'notebook','tools','multimeter','cable_tester','mobile_internet','ladder','drill','safety_gear']::text[]),
  CONSTRAINT equipment_max CHECK (cardinality(equipment) <= 8),
  CONSTRAINT transport_enum CHECK (transport_mode IS NULL OR transport_mode IN
    ('car','motorcycle','public_transport','bicycle','on_foot','other')),
  CONSTRAINT windows_enum CHECK (service_windows <@ ARRAY[
    'business','evening','overnight','weekend','holiday']::text[]),
  CONSTRAINT windows_max CHECK (cardinality(service_windows) <= 5),
  CONSTRAINT city_limit CHECK (cardinality(free_city_ids) <= 5 AND cardinality(paid_city_ids) <= 5),
  CONSTRAINT eta_bounds CHECK ((eta_business_minutes IS NULL OR eta_business_minutes BETWEEN 15 AND 1440)
    AND (eta_outside_minutes IS NULL OR eta_outside_minutes BETWEEN 15 AND 1440)),
  CONSTRAINT distance_bounds CHECK ((free_km IS NULL OR free_km BETWEEN 0 AND 2000)
    AND (km_threshold IS NULL OR km_threshold BETWEEN 0 AND 2000)),
  CONSTRAINT rate_bounds CHECK ((km_rate_cents IS NULL OR km_rate_cents BETWEEN 0 AND 50000)
    AND (km_rate_after_cents IS NULL OR km_rate_after_cents BETWEEN 0 AND 50000)
    AND (km_rate_after_cents IS NULL OR (km_rate_cents IS NOT NULL AND km_threshold IS NOT NULL)))
);
ALTER TABLE eut_profile_ops.technician_operations ENABLE ROW LEVEL SECURITY;
-- O dono (papel de implantação) só acessa a tabela por SECURITY DEFINER;
-- FORCE RLS bloquearia também esse caminho porque não há policies diretas.
REVOKE ALL ON eut_profile_ops.technician_operations FROM PUBLIC, anon, authenticated;

-- Explicit projection: additional columns must NEVER become public by default.
CREATE FUNCTION eut_profile_ops.safe_projection(v eut_profile_ops.technician_operations)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT pg_catalog.jsonb_build_object(
   'equipment',v.equipment,'transport_mode',v.transport_mode,'can_travel',v.can_travel,
   'service_windows',v.service_windows,
   'eta_business_minutes',v.eta_business_minutes,'eta_outside_minutes',v.eta_outside_minutes,
   'free_city_ids',v.free_city_ids,'paid_city_ids',v.paid_city_ids,
   'free_km',v.free_km,'km_threshold',v.km_threshold,
   'km_rate_cents',v.km_rate_cents,'km_rate_after_cents',v.km_rate_after_cents);
$$;

CREATE FUNCTION eut_profile_ops.private_get(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_owner uuid; v_row eut_profile_ops.technician_operations%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão necessária' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO v_owner FROM public.technicians WHERE id=_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ficha indisponível' USING ERRCODE='42501'; END IF;
 IF NOT (public.has_role(v_uid,'admin'::public.app_role) OR
    (v_owner=v_uid AND public.has_role(v_uid,'tecnico'::public.app_role))) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_row FROM eut_profile_ops.technician_operations WHERE technician_id=_id;
 IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',true,'profile',NULL,'updated_at',NULL); END IF;
 RETURN pg_catalog.jsonb_build_object('ok',true,'profile',eut_profile_ops.safe_projection(v_row),
   'updated_at',v_row.updated_at);
END; $$;

CREATE FUNCTION eut_profile_ops.private_save(_id uuid, _data jsonb,
  _expected_updated_at timestamptz, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid uuid := (SELECT auth.uid()); v_technician public.technicians%ROWTYPE;
 v_admin boolean; v_owner boolean; v_admin_edit boolean; v_reason text:=btrim(coalesce(_reason,''));
 v_new eut_profile_ops.technician_operations%ROWTYPE;
 v_old eut_profile_ops.technician_operations%ROWTYPE;
 v_saved eut_profile_ops.technician_operations%ROWTYPE;
 v_keys text[] := ARRAY['equipment','transport_mode','can_travel','service_windows',
   'eta_business_minutes','eta_outside_minutes','free_city_ids','paid_city_ids','free_km',
   'km_threshold','km_rate_cents','km_rate_after_cents'];
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão necessária' USING ERRCODE='42501'; END IF;
 -- Lock the canonical row before checking who may edit it; no moderation state is mutated.
 SELECT * INTO v_technician FROM public.technicians WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ficha indisponível' USING ERRCODE='42501'; END IF;
 v_admin := public.has_role(v_uid,'admin'::public.app_role);
 v_owner := v_technician.user_id=v_uid AND public.has_role(v_uid,'tecnico'::public.app_role);
 v_admin_edit := v_admin AND (NOT v_owner OR v_reason <> '');
 IF NOT v_admin AND NOT v_owner THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 -- Bloqueios de conta/telefone valem para TODO ator, inclusive o admin.
 -- A edição administrativa legítima de ficha suspensa/rejeitada continua autorizada.
 IF NOT public.eut_account_operational() THEN
   RAISE EXCEPTION 'Conta sem permissão operacional' USING ERRCODE='42501'; END IF;
 IF v_owner AND NOT v_admin_edit AND v_technician.status IN
   ('suspenso'::public.approval_status, 'rejeitado'::public.approval_status) THEN
   RAISE EXCEPTION 'Ficha indisponível para edição pelo titular' USING ERRCODE='42501'; END IF;
 IF v_admin_edit AND pg_catalog.char_length(v_reason) NOT BETWEEN 8 AND 400 THEN
   RAISE EXCEPTION 'Motivo administrativo obrigatório' USING ERRCODE='22023'; END IF;
 IF _data IS NULL OR pg_catalog.jsonb_typeof(_data)<>'object' OR NOT (_data ?& v_keys) OR
   EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(_data) k WHERE NOT(k=ANY(v_keys))) THEN
   RAISE EXCEPTION 'Campos operacionais inválidos' USING ERRCODE='22023'; END IF;
 IF pg_catalog.jsonb_typeof(_data->'equipment')<>'array' OR
   pg_catalog.jsonb_typeof(_data->'service_windows')<>'array' OR
   pg_catalog.jsonb_typeof(_data->'free_city_ids')<>'array' OR
   pg_catalog.jsonb_typeof(_data->'paid_city_ids')<>'array' OR
   pg_catalog.jsonb_typeof(_data->'can_travel')<>'boolean' THEN
   RAISE EXCEPTION 'Tipos de campos inválidos' USING ERRCODE='22023'; END IF;
 -- The record conversion validates integer/money types; constraints reject out-of-range values.
 v_new := pg_catalog.jsonb_populate_record(NULL::eut_profile_ops.technician_operations,_data);
 IF v_new.equipment IS NULL OR v_new.service_windows IS NULL OR
    v_new.free_city_ids IS NULL OR v_new.paid_city_ids IS NULL OR v_new.can_travel IS NULL THEN
   RAISE EXCEPTION 'Campos obrigatórios inválidos' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.unnest(v_new.equipment) e WHERE e IS NULL) OR
    EXISTS (SELECT 1 FROM pg_catalog.unnest(v_new.service_windows) e WHERE e IS NULL) OR
    EXISTS (SELECT 1 FROM pg_catalog.unnest(v_new.free_city_ids || v_new.paid_city_ids) e
      WHERE e IS NULL OR e NOT BETWEEN 1000000 AND 9999999) THEN
   RAISE EXCEPTION 'Código ou cidade inválida' USING ERRCODE='22023'; END IF;
 IF (SELECT pg_catalog.count(DISTINCT e) FROM pg_catalog.unnest(v_new.equipment) e)
     <> pg_catalog.cardinality(v_new.equipment) OR
    (SELECT pg_catalog.count(DISTINCT e) FROM pg_catalog.unnest(v_new.service_windows) e)
     <> pg_catalog.cardinality(v_new.service_windows) OR
    (SELECT pg_catalog.count(DISTINCT e) FROM pg_catalog.unnest(v_new.free_city_ids) e)
     <> pg_catalog.cardinality(v_new.free_city_ids) OR
    (SELECT pg_catalog.count(DISTINCT e) FROM pg_catalog.unnest(v_new.paid_city_ids) e)
     <> pg_catalog.cardinality(v_new.paid_city_ids) OR
    v_new.free_city_ids && v_new.paid_city_ids THEN
   RAISE EXCEPTION 'Opções repetidas ou conflitantes' USING ERRCODE='22023'; END IF;
 IF NOT ((v_new.free_city_ids || v_new.paid_city_ids) <@
    coalesce(v_technician.coverage_city_ids,'{}'::integer[])) THEN
    RAISE EXCEPTION 'Cidades fora da cobertura oficial' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_old FROM eut_profile_ops.technician_operations WHERE technician_id=_id FOR UPDATE;
 IF (v_old.technician_id IS NULL AND _expected_updated_at IS NOT NULL) OR
    (v_old.technician_id IS NOT NULL AND
      (_expected_updated_at IS NULL OR v_old.updated_at IS DISTINCT FROM _expected_updated_at)) THEN
    -- HTTP 409 explicito para o cliente PostgREST; 40001 pode acionar
    -- retentativa interna da transacao e esgotar o timeout do navegador.
    RAISE EXCEPTION 'Ficha alterada em outra sessão' USING ERRCODE='PT409'; END IF;
 INSERT INTO eut_profile_ops.technician_operations (
   technician_id,equipment,transport_mode,can_travel,service_windows,eta_business_minutes,
   eta_outside_minutes,free_city_ids,paid_city_ids,free_km,km_threshold,km_rate_cents,
   km_rate_after_cents,updated_at)
 VALUES (_id,v_new.equipment,v_new.transport_mode,v_new.can_travel,v_new.service_windows,
   v_new.eta_business_minutes,v_new.eta_outside_minutes,v_new.free_city_ids,
   v_new.paid_city_ids,v_new.free_km,v_new.km_threshold,v_new.km_rate_cents,
   v_new.km_rate_after_cents,pg_catalog.clock_timestamp())
 ON CONFLICT (technician_id) DO UPDATE SET
   equipment=excluded.equipment,transport_mode=excluded.transport_mode,
   can_travel=excluded.can_travel,service_windows=excluded.service_windows,
   eta_business_minutes=excluded.eta_business_minutes,eta_outside_minutes=excluded.eta_outside_minutes,
   free_city_ids=excluded.free_city_ids,paid_city_ids=excluded.paid_city_ids,
   free_km=excluded.free_km,km_threshold=excluded.km_threshold,
   km_rate_cents=excluded.km_rate_cents,km_rate_after_cents=excluded.km_rate_after_cents,
   updated_at=excluded.updated_at RETURNING * INTO v_saved;
 INSERT INTO public.eut_admin_management_log(actor_id,target_type,target_key,action,reason,before_state,after_state)
 VALUES (v_uid,'technician',_id::text,
   CASE WHEN v_admin_edit THEN 'technician_operations_admin_updated' ELSE 'technician_operations_self_updated' END,
   CASE WHEN v_admin_edit THEN v_reason ELSE 'Edição pelo titular' END,
   CASE WHEN v_old.technician_id IS NULL THEN '{}'::jsonb ELSE eut_profile_ops.safe_projection(v_old) END,
   eut_profile_ops.safe_projection(v_saved));
 RETURN pg_catalog.jsonb_build_object('ok',true,'technician_id',_id,'updated_at',v_saved.updated_at);
END; $$;

CREATE FUNCTION eut_profile_ops.public_get(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row eut_profile_ops.technician_operations%ROWTYPE;
BEGIN
 -- Reuse the SAME public eligibility gate as the search: status, phone and moderation.
 IF _id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.eut_public_eligible_technician_ids(ARRAY[_id]::uuid[]) e
   WHERE e.technician_id=_id) THEN RETURN NULL; END IF;
 SELECT * INTO v_row FROM eut_profile_ops.technician_operations WHERE technician_id=_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN eut_profile_ops.safe_projection(v_row);
END; $$;

-- Public wrappers run with caller privileges; privileged code lives in an
-- unexposed schema and performs explicit caller checks before accessing rows.
CREATE FUNCTION public.eut_technician_operations_get(_technician_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT eut_profile_ops.private_get(_technician_id); $$;
CREATE FUNCTION public.eut_technician_operations_save(_technician_id uuid,
  _payload jsonb, _expected_updated_at timestamptz DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $$
 SELECT eut_profile_ops.private_save(_technician_id,_payload,_expected_updated_at,_reason); $$;
CREATE FUNCTION public.eut_public_technician_operations(_technician_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT eut_profile_ops.public_get(_technician_id); $$;

REVOKE ALL ON FUNCTION eut_profile_ops.safe_projection(eut_profile_ops.technician_operations) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION eut_profile_ops.private_get(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION eut_profile_ops.private_save(uuid,jsonb,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION eut_profile_ops.public_get(uuid) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA eut_profile_ops TO anon,authenticated;
GRANT EXECUTE ON FUNCTION eut_profile_ops.private_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION eut_profile_ops.private_save(uuid,jsonb,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION eut_profile_ops.public_get(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_technician_operations_get(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_technician_operations_save(uuid,jsonb,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_public_technician_operations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_technician_operations_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_technician_operations_save(uuid,jsonb,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_technician_operations(uuid) TO anon,authenticated;
COMMIT;
