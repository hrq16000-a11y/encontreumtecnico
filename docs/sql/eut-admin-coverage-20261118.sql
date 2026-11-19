-- Owner-only CRUD for the regions declared by each technician; contacts stay private.
BEGIN;
CREATE OR REPLACE FUNCTION public.eut_admin_technician_coverage(
  _technician_id uuid, _payload jsonb DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_row eut_moderation.admin_technician_records%ROWTYPE;
  v_cities integer[];
  v_old_cities integer[];
  v_uf text;
  v_notes text;
  v_entire boolean;
  v_reason text := pg_catalog.btrim(coalesce(_reason,''));
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Admin verificado obrigatório' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM eut_moderation.admin_technician_records
    WHERE id=_technician_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Técnico não encontrado' USING ERRCODE='P0002'; END IF;
  SELECT coalesce(pg_catalog.array_agg(c.city_ibge_id ORDER BY c.city_ibge_id),ARRAY[]::integer[])
    INTO v_old_cities FROM eut_moderation.admin_technician_coverage c WHERE c.record_id=_technician_id;
  IF _payload IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',true,'updated_at',v_row.updated_at,
      'declared_uf',v_row.declared_uf,'coverage_notes',v_row.coverage_notes,
      'covers_entire_uf',v_row.covers_entire_uf,'coverage_city_ids',v_old_cities);
  END IF;
  IF v_row.archived_at IS NOT NULL OR v_row.is_demo OR _expected_updated_at IS NULL
    OR v_row.updated_at IS DISTINCT FROM _expected_updated_at
  THEN RAISE EXCEPTION 'Cadastro não editável ou desatualizado' USING ERRCODE='40001'; END IF;
  IF pg_catalog.jsonb_typeof(_payload)<>'object' OR
    NOT (_payload ?& ARRAY['city_ids','declared_uf','covers_entire_uf','coverage_notes']) OR
    pg_catalog.jsonb_typeof(_payload->'city_ids')<>'array' OR
    pg_catalog.jsonb_typeof(_payload->'covers_entire_uf')<>'boolean' OR
    pg_catalog.jsonb_typeof(_payload->'declared_uf') NOT IN ('null','string') OR
    pg_catalog.jsonb_typeof(_payload->'coverage_notes') NOT IN ('null','string')
  THEN RAISE EXCEPTION 'Formato de cobertura inválido' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(_payload->'city_ids') x
    WHERE pg_catalog.jsonb_typeof(x)<>'number' OR (x #>> '{}') !~ '^[0-9]{7}$')
  THEN RAISE EXCEPTION 'Município IBGE inválido' USING ERRCODE='22023'; END IF;
  v_cities := ARRAY(SELECT (x #>> '{}')::integer FROM pg_catalog.jsonb_array_elements(_payload->'city_ids') x);
  IF pg_catalog.cardinality(v_cities)>100 OR
    (SELECT count(*) FROM pg_catalog.unnest(v_cities) x)<>
      (SELECT count(DISTINCT x) FROM pg_catalog.unnest(v_cities) x) OR
    EXISTS (SELECT 1 FROM pg_catalog.unnest(v_cities) x
      LEFT JOIN public.eut_ibge_municipalities m ON m.id=x WHERE m.id IS NULL)
  THEN RAISE EXCEPTION 'Cobertura duplicada ou não cadastrada no IBGE' USING ERRCODE='22023'; END IF;
  v_uf:=nullif(pg_catalog.btrim(coalesce(_payload->>'declared_uf','')),'');
  v_notes:=nullif(pg_catalog.btrim(coalesce(_payload->>'coverage_notes','')),'');
  v_entire:=(_payload->>'covers_entire_uf')::boolean;
  IF v_uf IS NOT NULL AND (v_uf !~ '^[A-Z]{2}$' OR NOT EXISTS (
      SELECT 1 FROM public.eut_ibge_municipalities m WHERE m.uf=v_uf))
    OR (v_entire AND v_uf IS NULL)
    OR (v_entire AND EXISTS (SELECT 1 FROM public.eut_ibge_municipalities m
      WHERE m.id=v_row.city_ibge_id AND m.uf<>v_uf))
    OR length(v_reason) NOT BETWEEN 8 AND 400
    OR v_reason ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])'
    OR (v_notes IS NOT NULL AND (length(v_notes)>400 OR
      v_notes ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])'))
  THEN RAISE EXCEPTION 'UF, descrição ou justificativa inválida' USING ERRCODE='22023'; END IF;

  UPDATE eut_moderation.admin_technician_records SET
    declared_uf=v_uf,coverage_notes=v_notes,covers_entire_uf=v_entire,
    updated_at=pg_catalog.clock_timestamp() WHERE id=_technician_id;
  DELETE FROM eut_moderation.admin_technician_coverage
    WHERE record_id=_technician_id AND NOT(city_ibge_id=ANY(v_cities));
  INSERT INTO eut_moderation.admin_technician_coverage(record_id,city_ibge_id)
    SELECT _technician_id,x FROM pg_catalog.unnest(v_cities) x
    ON CONFLICT(record_id,city_ibge_id) DO NOTHING;
  INSERT INTO public.eut_admin_management_log
    (actor_id,target_type,target_key,action,reason,before_state,after_state)
  VALUES(v_actor,'technician',_technician_id::text,'registry_coverage_updated',v_reason,
    pg_catalog.jsonb_build_object('uf',v_row.declared_uf,'entire_uf',v_row.covers_entire_uf,
      'notes',v_row.coverage_notes,'cities',v_old_cities),
    pg_catalog.jsonb_build_object('uf',v_uf,'entire_uf',v_entire,
      'notes',v_notes,'cities',v_cities));
  RETURN pg_catalog.jsonb_build_object('ok',true,'updated_at',
    (SELECT r.updated_at FROM eut_moderation.admin_technician_records r WHERE r.id=_technician_id));
END;
$rpc$;
REVOKE ALL ON FUNCTION public.eut_admin_technician_coverage(uuid,jsonb,timestamptz,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_technician_coverage(uuid,jsonb,timestamptz,text)
  TO authenticated;
COMMIT;
