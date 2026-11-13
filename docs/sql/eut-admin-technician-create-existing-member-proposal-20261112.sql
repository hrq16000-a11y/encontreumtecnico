-- PROPOSAL ONLY: isolated/PostgreSQL QA. NOT installed in hosted EUT.
-- Production deployment requires explicit approval, migration provenance and auth QA.
-- Creates a PENDING technician profile only for an EXISTING verified Auth member
-- who already accepted technician role. It never creates Auth users, contact or approval.
BEGIN;
CREATE OR REPLACE FUNCTION public.eut_admin_technician_create(
  _target_user_id uuid,
  _display_name text,
  _city_ibge_id integer,
  _category_slug text,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_name text := btrim(coalesce(_display_name,''));
  v_reason text := btrim(coalesce(_reason,''));
  v_city text;
  v_uf text;
  v_created uuid;
  v_audit_id bigint;
BEGIN
  IF v_actor IS NULL OR
    NOT public.has_role(v_actor,'admin'::public.app_role) OR
    NOT public.eut_account_operational() OR
    NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=v_actor AND a.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Administrador verificado obrigatório' USING ERRCODE='42501'; END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 400 OR
     v_reason ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])'
  THEN RAISE EXCEPTION 'Motivo administrativo inválido' USING ERRCODE='22023'; END IF;
  IF char_length(v_name) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'Nome de 3 a 80 caracteres obrigatório' USING ERRCODE='22023'; END IF;
  IF _target_user_id IS NULL OR _target_user_id=v_actor THEN
    RAISE EXCEPTION 'Selecione outra conta técnica válida' USING ERRCODE='22023'; END IF;

  -- Only existing, confirmed, technician-role accounts with a canonical profile.
  IF NOT EXISTS(
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id=u.id
    JOIN public.user_roles r ON r.user_id=u.id AND r.role='tecnico'::public.app_role
    WHERE u.id=_target_user_id AND u.email_confirmed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id=_target_user_id
      AND r.role='admin'::public.app_role
  ) THEN RAISE EXCEPTION 'Conta técnica confirmada e sem ficha obrigatória'
    USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=_target_user_id)
    OR EXISTS(
      SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(c.phone_e164,'[^0-9]','','g')
      WHERE c.user_id=_target_user_id
    )
  THEN RAISE EXCEPTION 'Conta ou contato restrito' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.technicians t WHERE t.user_id=_target_user_id)
  THEN RAISE EXCEPTION 'Já existe ficha de técnico para esta conta' USING ERRCODE='23505'; END IF;

  SELECT m.name,m.uf INTO v_city,v_uf FROM public.eut_ibge_municipalities m
  WHERE m.id=_city_ibge_id;
  IF v_city IS NULL OR v_uf IS NULL THEN
    RAISE EXCEPTION 'Município IBGE inválido' USING ERRCODE='22023'; END IF;
  IF _category_slug IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.eut_service_categories c
    WHERE c.slug=_category_slug AND c.active
  ) THEN RAISE EXCEPTION 'Categoria inativa ou inexistente' USING ERRCODE='22023'; END IF;

  INSERT INTO public.technicians(
    id,user_id,display_name,city,state_uf,specialties,
    service_slugs,coverage_city_ids,status
  ) VALUES (
    pg_catalog.gen_random_uuid(),_target_user_id,v_name,v_city,v_uf,ARRAY[_category_slug],
    '{}'::text[],'{}'::integer[],'pendente'::public.approval_status
  ) RETURNING id INTO v_created;

  -- Mandatory atomic audit. Failure rolls back the whole creation.
  INSERT INTO public.eut_admin_management_log(
    actor_id,target_type,target_key,action,reason,before_state,after_state
  ) VALUES (
    v_actor,'technician',v_created::text,'technician_created',v_reason,'{}'::jsonb,
    pg_catalog.jsonb_build_object('status','pendente','city_ibge_id',_city_ibge_id,
      'category_slug',_category_slug,'existing_auth_member',true,'published',false)
  ) RETURNING id INTO v_audit_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'technician_id',v_created,'audit_id',v_audit_id,
    'status','pendente','city_ibge_id',_city_ibge_id,'category_slug',_category_slug
  );
END;
$rpc$;
REVOKE ALL ON FUNCTION public.eut_admin_technician_create(uuid,text,integer,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_technician_create(uuid,text,integer,text,text)
  TO authenticated;
COMMIT;
