-- PROPOSTA VERSIONADA, NÃO INSTALADA. Exige homologação isolada e autorização de SQL.
-- Escopo: somente cidade/UF, especialidades, serviços e cobertura territorial.
-- Nenhum contato privado, senha, pagamento, papel, status ou política RLS é alterado.
BEGIN;

CREATE OR REPLACE FUNCTION public.eut_admin_technician_catalog_edit(
  _technician_id uuid,
  _expected_updated_at timestamptz,
  _city_ibge_id integer,
  _specialties text[],
  _service_slugs text[],
  _coverage_city_ids integer[],
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(_reason, ''));
  v_before public.technicians%ROWTYPE;
  v_after public.technicians%ROWTYPE;
  v_city record;
  v_city_changed boolean;
  v_radius integer;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin'::public.app_role)
     OR NOT EXISTS (SELECT 1 FROM auth.users u
                    WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
     OR NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Administrador autenticado e confirmado é obrigatório' USING ERRCODE='42501';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 400 OR
     v_reason ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])' THEN
    RAISE EXCEPTION 'Motivo administrativo inválido ou com contato' USING ERRCODE='22023';
  END IF;
  IF _technician_id IS NULL OR _expected_updated_at IS NULL OR _city_ibge_id IS NULL THEN
    RAISE EXCEPTION 'Identificador, versão e município são obrigatórios' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_before FROM public.technicians WHERE id=_technician_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro técnico não encontrado' USING ERRCODE='P0002'; END IF;
  IF v_before.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'Cadastro alterado em outra sessão; atualize antes de salvar' USING ERRCODE='40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles r
             WHERE r.user_id=v_before.user_id AND r.role='admin'::public.app_role) THEN
    RAISE EXCEPTION 'Contas administrativas são protegidas' USING ERRCODE='42501';
  END IF;
  -- O CRUD territorial não remove bloqueios nem reabilita cadastros banidos.
  -- A liberação de uma conta deve seguir seu fluxo específico de moderação.
  IF EXISTS (SELECT 1 FROM eut_moderation.blocked_accounts b
             WHERE b.user_id=v_before.user_id) THEN
    RAISE EXCEPTION 'Cadastro bloqueado; trate a restrição na moderação' USING ERRCODE='42501';
  END IF;

  SELECT id,name,uf INTO v_city FROM public.eut_ibge_municipalities WHERE id=_city_ibge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Município fora da lista oficial IBGE' USING ERRCODE='22023'; END IF;

  IF _specialties IS NULL OR cardinality(_specialties) NOT BETWEEN 1 AND 30 OR
     cardinality(_specialties) <> (SELECT count(DISTINCT s) FROM unnest(_specialties) s) OR
     EXISTS (SELECT 1 FROM unnest(_specialties) s
             LEFT JOIN public.eut_service_categories c ON c.slug=s AND c.active
             WHERE c.slug IS NULL) THEN
    RAISE EXCEPTION 'Especialidades inválidas, duplicadas ou inativas' USING ERRCODE='22023';
  END IF;
  IF _service_slugs IS NULL OR cardinality(_service_slugs)>64 OR
     cardinality(_service_slugs) <> (SELECT count(DISTINCT s) FROM unnest(_service_slugs) s) OR
     EXISTS (SELECT 1 FROM unnest(_service_slugs) s
             LEFT JOIN public.eut_service_types t ON t.slug=s AND t.active
             LEFT JOIN public.eut_service_categories c ON c.slug=t.category_slug AND c.active
             WHERE t.slug IS NULL OR c.slug IS NULL OR NOT t.category_slug=ANY(_specialties)) THEN
    RAISE EXCEPTION 'Serviços incompatíveis com as especialidades' USING ERRCODE='22023';
  END IF;
  IF _coverage_city_ids IS NULL OR cardinality(_coverage_city_ids)>5 OR
     cardinality(_coverage_city_ids) <> (SELECT count(DISTINCT c) FROM unnest(_coverage_city_ids) c) OR
     EXISTS (SELECT 1 FROM unnest(_coverage_city_ids) c
             LEFT JOIN public.eut_ibge_municipalities m ON m.id=c WHERE m.id IS NULL) THEN
    RAISE EXCEPTION 'Cobertura territorial inválida ou repetida' USING ERRCODE='22023';
  END IF;
  IF v_before.status='aprovado'::public.approval_status AND
     (cardinality(_coverage_city_ids)<1 OR NOT _city_ibge_id=ANY(_coverage_city_ids)) THEN
    RAISE EXCEPTION 'Cidade-base obrigatória na cobertura de perfil aprovado' USING ERRCODE='22023';
  END IF;
  IF v_before.status<>'aprovado'::public.approval_status AND cardinality(_coverage_city_ids)<>0 THEN
    RAISE EXCEPTION 'Cobertura somente para perfil aprovado' USING ERRCODE='22023';
  END IF;

  v_city_changed := v_before.city IS DISTINCT FROM v_city.name OR
                    v_before.state_uf IS DISTINCT FROM v_city.uf;
  v_radius := CASE WHEN v_city_changed THEN NULL ELSE v_before.service_radius_km END;
  -- O gatilho atual limpa a cobertura após mudança da cidade-base. Ambas as
  -- atualizações ocorrem nesta mesma transação e a segunda confirma a cobertura.
  PERFORM pg_catalog.set_config('eut.admin_reason', v_reason, true);
  UPDATE public.technicians SET
    city=v_city.name, state_uf=v_city.uf,
    specialties=_specialties, service_slugs=_service_slugs
    WHERE id=_technician_id;
  UPDATE public.technicians SET
    coverage_city_ids=_coverage_city_ids, service_radius_km=v_radius
    WHERE id=_technician_id RETURNING * INTO v_after;
  IF v_after.id IS NULL THEN RAISE EXCEPTION 'Alteração não gravada' USING ERRCODE='P0002'; END IF;

  -- Registro específico obrigatório: o gatilho administrativo legado não audita
  -- city/state_uf/specialties/service_slugs. Nunca armazenar contato no log.
  INSERT INTO public.eut_admin_management_log
    (actor_id,target_type,target_key,action,reason,before_state,after_state)
  VALUES (v_actor,'technician',_technician_id::text,'technician_catalog_edit',v_reason,
    pg_catalog.jsonb_build_object('city',v_before.city,'uf',v_before.state_uf,
      'specialties',v_before.specialties,'services',v_before.service_slugs,
      'coverage_city_ids',v_before.coverage_city_ids,'radius_km',v_before.service_radius_km),
    pg_catalog.jsonb_build_object('city',v_after.city,'uf',v_after.state_uf,
      'specialties',v_after.specialties,'services',v_after.service_slugs,
      'coverage_city_ids',v_after.coverage_city_ids,'radius_km',v_after.service_radius_km));
  RETURN pg_catalog.jsonb_build_object('ok',true,'technician_id',v_after.id,
    'updated_at',v_after.updated_at,'status',v_after.status::text);
END;
$rpc$;

REVOKE ALL ON FUNCTION public.eut_admin_technician_catalog_edit(
  uuid,timestamptz,integer,text[],text[],integer[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_technician_catalog_edit(
  uuid,timestamptz,integer,text[],text[],integer[],text) TO authenticated;
COMMIT;
