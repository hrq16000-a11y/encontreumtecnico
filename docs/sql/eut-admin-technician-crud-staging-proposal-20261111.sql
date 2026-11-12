-- PROPOSAL ONLY. NOT INSTALLED. Never apply to production from CI or chat.
-- Requires an authorized isolated staging database and schema/permission review.
-- Postgres RPC signatures match docs/admin/CRUD_TRANSACIONAL_AUDITADO_2026-11-11.md.
BEGIN;

-- Separate, private, reversible archive marker. No deletion of users, contacts or history.
CREATE TABLE IF NOT EXISTS eut_moderation.archived_technicians (
  technician_id uuid PRIMARY KEY REFERENCES public.technicians(id) ON DELETE RESTRICT,
  previous_status public.approval_status NOT NULL,
  archived_by uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
ALTER TABLE eut_moderation.archived_technicians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.archived_technicians FROM PUBLIC, anon, authenticated;

-- This unique index is a PROPOSED preflight gate: if production contains duplicate
-- phones it will fail and those records must be reconciled before any installation.
-- It prevents concurrent owner/admin registrations of the same contact.
CREATE UNIQUE INDEX IF NOT EXISTS eut_private_contact_e164_unique
  ON public.eut_technician_private_contacts(phone_e164);

CREATE OR REPLACE FUNCTION public.eut_admin_technician_change(
  _technician_id uuid,
  _expected_updated_at timestamptz,
  _payload jsonb,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(_reason,''));
  v_before public.technicians%ROWTYPE;
  v_after public.technicians%ROWTYPE;
  v_city record;
  v_base integer;
  v_coverage integer[];
  v_categories text[];
  v_services text[];
  v_radius integer;
  v_neighborhood text;
  v_phone_action text;
  v_phone text;
  v_allow boolean := false;
  v_old_phone text;
  v_new_phone text;
  v_blocked boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT EXISTS (SELECT 1 FROM auth.users u
      WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Admin verificado obrigatório' USING ERRCODE='42501'; END IF;
  IF length(v_reason) NOT BETWEEN 8 AND 400
    OR v_reason ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])'
  THEN RAISE EXCEPTION 'Justificativa administrativa inválida' USING ERRCODE='22023'; END IF;
  IF _technician_id IS NULL OR _expected_updated_at IS NULL OR
    _payload IS NULL OR jsonb_typeof(_payload)<>'object' THEN
    RAISE EXCEPTION 'Identificador, versão e dados obrigatórios' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(_payload) k
    WHERE k NOT IN ('base_city_ibge_id','coverage_city_ids','radius_km','neighborhood',
                    'category_slugs','service_slugs','phone_action','phone_e164','allow_paid_contact'))
  THEN RAISE EXCEPTION 'Campo não permitido' USING ERRCODE='22023'; END IF;
  IF NOT (_payload ?& ARRAY['base_city_ibge_id','coverage_city_ids','radius_km',
                            'category_slugs','service_slugs','phone_action']) THEN
    RAISE EXCEPTION 'Campos de edição incompletos' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_before FROM public.technicians WHERE id=_technician_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado' USING ERRCODE='P0002'; END IF;
  IF v_before.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'Cadastro alterado em outra sessão; recarregue antes de salvar'
      USING ERRCODE='40001'; END IF;
  IF EXISTS (SELECT 1 FROM eut_moderation.archived_technicians a
             WHERE a.technician_id=_technician_id AND a.restored_at IS NULL) THEN
    RAISE EXCEPTION 'Restaure o arquivo antes de editar' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles r
      WHERE r.user_id=v_before.user_id AND r.role='admin'::public.app_role) THEN
    RAISE EXCEPTION 'Conta administrativa protegida' USING ERRCODE='42501'; END IF;

  IF jsonb_typeof(_payload->'base_city_ibge_id')<>'number'
    OR (_payload->>'base_city_ibge_id') !~ '^[0-9]{7}$' THEN
    RAISE EXCEPTION 'Selecione município oficial IBGE' USING ERRCODE='22023'; END IF;
  v_base:=(_payload->>'base_city_ibge_id')::integer;
  SELECT id,name,uf INTO v_city FROM public.eut_ibge_municipalities WHERE id=v_base;
  IF NOT FOUND THEN RAISE EXCEPTION 'Município fora da lista oficial' USING ERRCODE='22023'; END IF;

  IF jsonb_typeof(_payload->'coverage_city_ids')<>'array' OR
     jsonb_typeof(_payload->'category_slugs')<>'array' OR
     jsonb_typeof(_payload->'service_slugs')<>'array' THEN
    RAISE EXCEPTION 'Listas inválidas' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_payload->'coverage_city_ids') x
     WHERE jsonb_typeof(x)<>'number' OR x::text !~ '^[0-9]{7}$') THEN
    RAISE EXCEPTION 'Código IBGE inválido' USING ERRCODE='22023'; END IF;
  v_coverage:=ARRAY(SELECT x::integer FROM jsonb_array_elements_text(_payload->'coverage_city_ids') x);
  v_categories:=ARRAY(SELECT x FROM jsonb_array_elements_text(_payload->'category_slugs') x);
  v_services:=ARRAY(SELECT x FROM jsonb_array_elements_text(_payload->'service_slugs') x);

  IF cardinality(v_coverage)>5 OR
     cardinality(v_coverage) <> (SELECT count(DISTINCT x) FROM unnest(v_coverage) x)
     OR EXISTS (SELECT 1 FROM unnest(v_coverage) x
        LEFT JOIN public.eut_ibge_municipalities m ON m.id=x WHERE m.id IS NULL) THEN
    RAISE EXCEPTION 'Cidades de cobertura inválidas ou repetidas' USING ERRCODE='22023'; END IF;
  IF v_before.status='aprovado'::public.approval_status AND
     (cardinality(v_coverage)<1 OR NOT v_base=ANY(v_coverage)) THEN
    RAISE EXCEPTION 'A cidade-base deve integrar a cobertura' USING ERRCODE='22023'; END IF;
  IF v_before.status<>'aprovado'::public.approval_status
     AND cardinality(v_coverage)<>0 THEN
    RAISE EXCEPTION 'Cobertura requer perfil aprovado' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(_payload->'radius_km') NOT IN ('null','number')
    OR (_payload->>'radius_km') IS NOT NULL
       AND (_payload->>'radius_km') !~ '^[0-9]{1,3}$' THEN
    RAISE EXCEPTION 'Raio inválido' USING ERRCODE='22023'; END IF;
  v_radius:=(_payload->>'radius_km')::integer;
  IF v_radius IS NOT NULL AND
     (v_before.status<>'aprovado'::public.approval_status OR
      v_radius NOT IN (5,10,20,30,50,75,100,150,200,300)) THEN
    RAISE EXCEPTION 'Raio não permitido' USING ERRCODE='22023'; END IF;

  IF cardinality(v_categories)<1 OR cardinality(v_categories)>30 OR
     cardinality(v_categories)<>(SELECT count(DISTINCT x) FROM unnest(v_categories) x)
     OR EXISTS (SELECT 1 FROM unnest(v_categories) x
       LEFT JOIN public.eut_service_categories c ON c.slug=x AND c.active
       WHERE c.slug IS NULL) THEN
    RAISE EXCEPTION 'Categorias inválidas ou inativas' USING ERRCODE='22023'; END IF;
  IF cardinality(v_services)>64 OR
     cardinality(v_services)<>(SELECT count(DISTINCT x) FROM unnest(v_services) x)
     OR EXISTS (SELECT 1 FROM unnest(v_services) x
       LEFT JOIN public.eut_service_types s ON s.slug=x AND s.active
       LEFT JOIN public.eut_service_categories c ON c.slug=s.category_slug AND c.active
       WHERE s.slug IS NULL OR c.slug IS NULL OR NOT s.category_slug=ANY(v_categories)) THEN
    RAISE EXCEPTION 'Serviços inválidos ou incompatíveis' USING ERRCODE='22023'; END IF;

  IF _payload ? 'neighborhood' AND jsonb_typeof(_payload->'neighborhood') NOT IN ('null','string') THEN
    RAISE EXCEPTION 'Bairro inválido' USING ERRCODE='22023'; END IF;
  v_neighborhood:=nullif(btrim(coalesce(_payload->>'neighborhood','')),'');
  IF v_neighborhood IS NOT NULL AND
      (length(v_neighborhood) NOT BETWEEN 2 AND 100 OR
       v_neighborhood ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])') THEN
    RAISE EXCEPTION 'Bairro inválido' USING ERRCODE='22023'; END IF;

  v_phone_action:=_payload->>'phone_action';
  IF v_phone_action NOT IN ('keep','replace','remove') OR v_phone_action IS NULL THEN
    RAISE EXCEPTION 'Ação de telefone inválida' USING ERRCODE='22023'; END IF;
  IF v_phone_action<>'replace' AND
     (_payload ? 'phone_e164' OR _payload ? 'allow_paid_contact') THEN
    RAISE EXCEPTION 'Campos de telefone não permitidos' USING ERRCODE='22023'; END IF;

  SELECT c.phone_e164 INTO v_old_phone FROM public.eut_technician_private_contacts c
    WHERE c.user_id=v_before.user_id FOR UPDATE;
  v_blocked:=EXISTS (SELECT 1 FROM eut_moderation.blocked_accounts b
    WHERE b.user_id=v_before.user_id)
    OR EXISTS (SELECT 1 FROM eut_moderation.blocked_phones b
       WHERE b.phone_digits=regexp_replace(coalesce(v_old_phone,''),'[^0-9]','','g'));
  IF v_phone_action='replace' THEN
    IF jsonb_typeof(_payload->'phone_e164')<>'string'
       OR (_payload->>'phone_e164') !~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'
       OR jsonb_typeof(_payload->'allow_paid_contact')<>'boolean' THEN
      RAISE EXCEPTION 'Contato E.164 inválido' USING ERRCODE='22023'; END IF;
    v_phone:=_payload->>'phone_e164';
    v_allow:=(_payload->>'allow_paid_contact')::boolean;
    IF v_blocked OR EXISTS (SELECT 1 FROM eut_moderation.blocked_phones b
      WHERE b.phone_digits=regexp_replace(v_phone,'[^0-9]','','g')) THEN
      RAISE EXCEPTION 'Conta ou número bloqueado; restrição deve ser tratada separadamente'
        USING ERRCODE='P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.eut_technician_private_contacts c
      WHERE c.phone_e164=v_phone AND c.user_id<>v_before.user_id) THEN
      RAISE EXCEPTION 'Contato já vinculado a outro técnico' USING ERRCODE='23505'; END IF;
  END IF;

  -- The existing city trigger resets previous coverage when base city changes.
  -- Both updates are in one RPC transaction: no partially published coverage.
  PERFORM pg_catalog.set_config('eut.admin_reason',v_reason,true);
  UPDATE public.technicians SET
    city=v_city.name,state_uf=v_city.uf,neighborhood=v_neighborhood,
    specialties=v_categories,service_slugs=v_services
    WHERE id=_technician_id;
  UPDATE public.technicians SET
    coverage_city_ids=v_coverage,service_radius_km=v_radius
    WHERE id=_technician_id RETURNING * INTO v_after;
  IF v_after.id IS NULL THEN RAISE EXCEPTION 'Falha de gravação' USING ERRCODE='P0002'; END IF;

  IF v_phone_action='replace' THEN
    INSERT INTO public.eut_technician_private_contacts
      (user_id,phone_e164,allow_paid_contact,updated_at)
    VALUES(v_before.user_id,v_phone,v_allow,now())
    ON CONFLICT (user_id) DO UPDATE SET phone_e164=excluded.phone_e164,
      allow_paid_contact=excluded.allow_paid_contact,updated_at=now();
  ELSIF v_phone_action='remove' THEN
    DELETE FROM public.eut_technician_private_contacts
      WHERE user_id=v_before.user_id;
  END IF;
  SELECT c.phone_e164 INTO v_new_phone FROM public.eut_technician_private_contacts c
    WHERE c.user_id=v_before.user_id;

  -- The audit is mandatory; any failure rolls back all edits including contacts.
  INSERT INTO public.eut_admin_management_log
    (actor_id,target_type,target_key,action,reason,before_state,after_state)
  VALUES (v_actor,'technician',_technician_id::text,'technician_comprehensive_edit',v_reason,
    pg_catalog.jsonb_build_object(
      'city',v_before.city,'uf',v_before.state_uf,'neighborhood',v_before.neighborhood,
      'coverage_city_ids',v_before.coverage_city_ids,'radius_km',v_before.service_radius_km,
      'categories',v_before.specialties,'services',v_before.service_slugs,
      'phone_last4',CASE WHEN v_old_phone IS NULL THEN NULL ELSE right(v_old_phone,4) END),
    pg_catalog.jsonb_build_object(
      'city',v_after.city,'uf',v_after.state_uf,'neighborhood',v_after.neighborhood,
      'coverage_city_ids',v_after.coverage_city_ids,'radius_km',v_after.service_radius_km,
      'categories',v_after.specialties,'services',v_after.service_slugs,
      'phone_changed',v_phone_action<>'keep',
      'phone_last4',CASE WHEN v_new_phone IS NULL THEN NULL ELSE right(v_new_phone,4) END));
  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'technician_id',v_after.id,
    'updated_at',v_after.updated_at,'status',v_after.status::text,
    'phone_changed',v_phone_action<>'keep');
END;
$rpc$;

CREATE OR REPLACE FUNCTION public.eut_admin_technician_archive(
  _technician_id uuid,
  _expected_updated_at timestamptz,
  _action text,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $rpc$
DECLARE
  v_actor uuid:=auth.uid();
  v_reason text:=btrim(coalesce(_reason,''));
  v_before public.technicians%ROWTYPE;
  v_after public.technicians%ROWTYPE;
  v_archived boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v_actor
      AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Admin verificado obrigatório' USING ERRCODE='42501'; END IF;
  IF length(v_reason) NOT BETWEEN 8 AND 400
    OR v_reason ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])' THEN
    RAISE EXCEPTION 'Justificativa inválida' USING ERRCODE='22023'; END IF;
  IF _technician_id IS NULL OR _expected_updated_at IS NULL OR
     _action NOT IN ('archive','restore') OR _action IS NULL THEN
    RAISE EXCEPTION 'Ação ou registro inválidos' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_before FROM public.technicians WHERE id=_technician_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado' USING ERRCODE='P0002'; END IF;
  IF v_before.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'Cadastro alterado em outra sessão; recarregue antes de salvar'
      USING ERRCODE='40001'; END IF;
  IF v_before.user_id=v_actor OR EXISTS (
     SELECT 1 FROM public.user_roles r WHERE r.user_id=v_before.user_id
       AND r.role='admin'::public.app_role) THEN
    RAISE EXCEPTION 'Conta administrativa protegida' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM eut_moderation.archived_technicians a
     WHERE a.technician_id=_technician_id AND a.restored_at IS NULL) INTO v_archived;
  PERFORM pg_catalog.set_config('eut.admin_reason',v_reason,true);
  IF _action='archive' THEN
    IF v_archived THEN RAISE EXCEPTION 'Cadastro já arquivado' USING ERRCODE='22023'; END IF;
    -- Private archive marker preserves historic state without deleting user or requests.
    INSERT INTO eut_moderation.archived_technicians
      (technician_id,previous_status,archived_by,archived_at,restored_at)
    VALUES(_technician_id,v_before.status,v_actor,now(),NULL)
    ON CONFLICT (technician_id) DO UPDATE
      SET previous_status=excluded.previous_status,archived_by=excluded.archived_by,
          archived_at=now(),restored_at=NULL;
    UPDATE public.technicians SET status='suspenso',
      coverage_city_ids='{}'::integer[],service_radius_km=NULL,reviewed_at=now()
      WHERE id=_technician_id RETURNING * INTO v_after;
    UPDATE public.eut_technician_private_contacts
      SET allow_paid_contact=false,updated_at=now() WHERE user_id=v_before.user_id;
  ELSE
    IF NOT v_archived THEN RAISE EXCEPTION 'Cadastro não está arquivado' USING ERRCODE='22023'; END IF;
    UPDATE public.technicians SET status='pendente',
      coverage_city_ids='{}'::integer[],service_radius_km=NULL,reviewed_at=now()
      WHERE id=_technician_id RETURNING * INTO v_after;
    UPDATE eut_moderation.archived_technicians SET restored_at=now()
      WHERE technician_id=_technician_id AND restored_at IS NULL;
    -- Never restore paid contact consent nor remove account/phone bans.
  END IF;
  INSERT INTO public.eut_admin_management_log
    (actor_id,target_type,target_key,action,reason,before_state,after_state)
    VALUES(v_actor,'technician',_technician_id::text,
      CASE WHEN _action='archive' THEN 'technician_archived' ELSE 'technician_restored_pending' END,
      v_reason,
      pg_catalog.jsonb_build_object('status',v_before.status::text,'archived',v_archived),
      pg_catalog.jsonb_build_object('status',v_after.status::text,
        'archived',_action='archive','bans_preserved',true,'phone_authorized',false));
  RETURN pg_catalog.jsonb_build_object(
     'ok',true,'technician_id',v_after.id,'updated_at',v_after.updated_at,
     'status',v_after.status::text,'archived',_action='archive','contact_enabled',false);
END;
$rpc$;

REVOKE ALL ON FUNCTION public.eut_admin_technician_change(uuid,timestamptz,jsonb,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_admin_technician_archive(uuid,timestamptz,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_technician_change(uuid,timestamptz,jsonb,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_technician_archive(uuid,timestamptz,text,text)
  TO authenticated;
COMMIT;
