-- PROPOSAL ONLY: NEVER APPLY DIRECTLY TO HOSTED SUPABASE.
-- Single canonical table = public.technicians; user_id may be null for an unclaimed record.
-- No public search change, no Auth provisioning, no payment, no phone disclosure in this phase.
-- Migration provenance, trigger/RLS compatibility and production rollback require separate approval.
BEGIN;

ALTER TABLE public.technicians
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN display_name DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS catalog_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_origin text NOT NULL DEFAULT 'organic_auth',
  ADD COLUMN IF NOT EXISTS ddd_hint text;
-- Source keys are not kept in public: anon has SELECT on this RLS-protected table.

-- Existing suspensions, rejections and bans MUST NOT be reset when catalog
-- activation is introduced. New Auth-less admin imports still default to true.
UPDATE public.technicians AS t SET catalog_enabled=false
WHERE t.user_id IS NOT NULL AND (
   t.status IS DISTINCT FROM 'aprovado'::public.approval_status
   OR EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=t.user_id)
   OR EXISTS(SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(c.phone_e164,'[^0-9]','','g')
      WHERE c.user_id=t.user_id)
);
-- Future public eligibility MUST ALSO re-check bans at query time.
-- Existing Auth profiles keep their current ids, roles, status, slugs and private contacts.
-- Existing "status" is LEGACY publication/moderation; catalog_enabled is the
-- new operational toggle. Do not interpret legacy 'pendente' as a manual review
-- requirement for catalog records. Public search cutover is a separate R2 gate.

CREATE TABLE IF NOT EXISTS eut_moderation.catalog_private_contacts(
  technician_id uuid PRIMARY KEY REFERENCES public.technicians(id) ON DELETE RESTRICT,
  phone_e164 text NOT NULL CHECK(phone_e164 ~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'),
  allow_paid_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eut_moderation.catalog_private_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.catalog_private_contacts FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS eut_moderation.catalog_provenance(
  technician_id uuid PRIMARY KEY REFERENCES public.technicians(id) ON DELETE RESTRICT,
  catalog_origin text NOT NULL CHECK(catalog_origin IN ('admin_manual','external_import','wordpress')),
  source_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalog_origin,source_key)
);
ALTER TABLE eut_moderation.catalog_provenance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.catalog_provenance FROM PUBLIC, anon, authenticated;
-- This private 1:1 mapping is provenance, NOT a parallel technician registry.
-- This is the private Auth-less bridge keyed to the SAME technicians.id, not a second
-- people registry. Existing public.eut_technician_private_contacts is untouched.

CREATE OR REPLACE FUNCTION eut_moderation.audit_catalog_operational_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $guard$
DECLARE v_actor uuid:=auth.uid();
        v_reason text:=btrim(coalesce(current_setting('eut.catalog_change_reason',true),''));
BEGIN
  IF OLD.catalog_origin IS DISTINCT FROM NEW.catalog_origin
     OR OLD.ddd_hint IS DISTINCT FROM NEW.ddd_hint
  THEN RAISE EXCEPTION 'Origem ou DDD somente por operação auditada'
    USING ERRCODE='42501'; END IF;
  IF OLD.catalog_enabled IS DISTINCT FROM NEW.catalog_enabled THEN
    IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
       OR NOT public.eut_account_operational()
       OR length(v_reason) NOT BETWEEN 8 AND 400
       OR v_reason ~* '(https?://|www[.]|wa[.]me|@|[+][0-9][0-9 ()-]{8,})'
    THEN RAISE EXCEPTION 'Use operação administrativa auditada'
      USING ERRCODE='42501'; END IF;
    INSERT INTO public.eut_admin_management_log(
      actor_id,target_type,target_key,action,reason,before_state,after_state)
    VALUES(v_actor,'technician',NEW.id::text,'catalog_enabled_changed',v_reason,
      jsonb_build_object('enabled',OLD.catalog_enabled),
      jsonb_build_object('enabled',NEW.catalog_enabled));
  END IF;
  RETURN NEW;
END;
$guard$;
CREATE TRIGGER eut_catalog_operational_guard
BEFORE UPDATE OF catalog_enabled,catalog_origin,ddd_hint ON public.technicians
FOR EACH ROW EXECUTE FUNCTION eut_moderation.audit_catalog_operational_edit();

CREATE OR REPLACE FUNCTION public.eut_admin_catalog_upsert(
  _origin text, _source_key text, _label text, _city_ibge integer,
  _category_slug text, _phone_input text, _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $rpc$
DECLARE
  v_actor uuid:=auth.uid();
  v_origin text:=lower(btrim(coalesce(_origin,'')));
  v_source text:=btrim(coalesce(_source_key,''));
  v_label text:=nullif(btrim(coalesce(_label,'')),'');
  v_reason text:=btrim(coalesce(_reason,''));
  v_digits text;
  v_phone text;
  v_ddd text;
  v_city text;
  v_uf text;
  v_category text;
  v_id uuid;
  v_existing uuid;
  v_old_phone text;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT public.eut_account_operational()
    OR NOT EXISTS(SELECT 1 FROM auth.users u
                  WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Administrador verificado obrigatório' USING ERRCODE='42501'; END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 400 OR
    v_reason ~* '(https?://|www[.]|wa[.]me|@|[+][0-9][0-9 ()-]{8,})'
  THEN RAISE EXCEPTION 'Motivo administrativo inválido' USING ERRCODE='22023'; END IF;
  IF v_origin NOT IN ('admin_manual','external_import','wordpress') OR
    v_source !~ '^[A-Za-z0-9][A-Za-z0-9_:/.-]{2,119}$' OR
    v_source ~ '^[0-9]{10,13}$'
  THEN RAISE EXCEPTION 'Chave de procedência inválida' USING ERRCODE='22023'; END IF;
  IF v_label IS NOT NULL AND (char_length(v_label)>100 OR
    v_label ~* '(https?://|www[.]|wa[.]me|@|[+][0-9][0-9 ()-]{8,})')
  THEN RAISE EXCEPTION 'Rótulo público inválido' USING ERRCODE='22023'; END IF;

  IF nullif(btrim(coalesce(_phone_input,'')),'') IS NOT NULL THEN
    -- Reject arbitrary text/extensions, using the existing private-contact format.
    IF length(_phone_input)>40 OR _phone_input !~ '^[+]?[0-9 ().-]+$'
       OR (left(btrim(_phone_input),1)='+' AND
           left(regexp_replace(_phone_input,'[^0-9]','','g'),2)<>'55')
    THEN RAISE EXCEPTION 'Formato de telefone inválido' USING ERRCODE='22023'; END IF;
    v_digits:=regexp_replace(_phone_input,'[^0-9]','','g');
    IF left(v_digits,2)='55' AND length(v_digits) IN (12,13)
      THEN v_digits:=substr(v_digits,3); END IF;
    IF v_digits !~ '^[1-9]{2}[2-9][0-9]{7,8}$'
    THEN RAISE EXCEPTION 'Telefone brasileiro inválido' USING ERRCODE='22023'; END IF;
    v_ddd:=left(v_digits,2);
    v_phone:='+55'||v_digits;
    IF EXISTS(SELECT 1 FROM eut_moderation.blocked_phones b
      WHERE b.phone_digits=regexp_replace(v_phone,'[^0-9]','','g'))
    THEN RAISE EXCEPTION 'Contato restrito' USING ERRCODE='42501'; END IF;
  END IF;
  IF v_label IS NULL AND v_phone IS NULL
  THEN RAISE EXCEPTION 'Nome ou telefone obrigatório' USING ERRCODE='22023'; END IF;

  IF _city_ibge IS NOT NULL THEN
    SELECT m.name,m.uf INTO v_city,v_uf FROM public.eut_ibge_municipalities m
      WHERE m.id=_city_ibge;
    IF v_city IS NULL THEN RAISE EXCEPTION 'Município IBGE inválido'
       USING ERRCODE='22023'; END IF;
  END IF;
  IF nullif(btrim(coalesce(_category_slug,'')),'') IS NOT NULL THEN
    SELECT c.slug INTO v_category FROM public.eut_service_categories c
      WHERE c.slug=_category_slug AND c.active;
    IF v_category IS NULL THEN RAISE EXCEPTION 'Categoria inválida ou inativa'
       USING ERRCODE='22023'; END IF;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_origin||':'||v_source,0));
  SELECT p.technician_id INTO v_existing
    FROM eut_moderation.catalog_provenance p
    JOIN public.technicians t ON t.id=p.technician_id
    WHERE p.catalog_origin=v_origin AND p.source_key=v_source
    FOR UPDATE OF p,t;
  IF v_existing IS NOT NULL THEN
    SELECT c.phone_e164 INTO v_old_phone FROM eut_moderation.catalog_private_contacts c
      WHERE c.technician_id=v_existing;
    IF v_phone IS NOT NULL AND v_old_phone IS DISTINCT FROM v_phone THEN
      RETURN jsonb_build_object('ok',false,'conflict',true,
        'code','source_phone_conflict','technician_id',v_existing);
    END IF;
    RETURN jsonb_build_object('ok',true,'created',false,'technician_id',v_existing,
      'catalog_enabled',(SELECT t.catalog_enabled FROM public.technicians t WHERE t.id=v_existing),
      'contact_available',(v_old_phone IS NOT NULL),'published',false);
  END IF;

  -- Stable source key wins concurrent races. Never auto-merge by a matching name or phone.
  INSERT INTO public.technicians(
    id,user_id,display_name,city,state_uf,specialties,service_slugs,
    coverage_city_ids,status,catalog_enabled,catalog_origin,ddd_hint
  ) VALUES(
    pg_catalog.gen_random_uuid(),NULL,v_label,v_city,v_uf,
    CASE WHEN v_category IS NULL THEN '{}'::text[] ELSE ARRAY[v_category] END,
    '{}'::text[],'{}'::integer[],'pendente'::public.approval_status,
    true,v_origin,v_ddd
  ) RETURNING id INTO v_id;

  INSERT INTO eut_moderation.catalog_provenance(technician_id,catalog_origin,source_key)
  VALUES(v_id,v_origin,v_source);

  IF v_phone IS NOT NULL THEN
    INSERT INTO eut_moderation.catalog_private_contacts(technician_id,phone_e164)
      VALUES(v_id,v_phone);
  END IF;
  -- Atomic audit: failure MUST roll back the record and the private contact.
  INSERT INTO public.eut_admin_management_log(
    actor_id,target_type,target_key,action,reason,before_state,after_state)
  VALUES(v_actor,'technician',v_id::text,'catalog_created',v_reason,'{}'::jsonb,
    jsonb_build_object('catalog_enabled',true,'origin',v_origin,
      'city_ibge_id',_city_ibge,'category',v_category,
      'ddd_hint',v_ddd,'has_private_contact',v_phone IS NOT NULL,
      'public_contact_disclosed',false,'auth_user_created',false));
  RETURN jsonb_build_object('ok',true,'created',true,'technician_id',v_id,
      'catalog_enabled',true,'contact_available',v_phone IS NOT NULL,'published',false);
END;
$rpc$;

CREATE OR REPLACE FUNCTION public.eut_admin_catalog_import_batch(
  _rows jsonb, _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='pg_catalog' AS $rpc$
DECLARE v_row jsonb; v_results jsonb:='[]'::jsonb; v_n integer; v_reply jsonb;
BEGIN
  IF _rows IS NULL OR jsonb_typeof(_rows)<>'array' OR
     jsonb_array_length(_rows) NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'Lote deve conter de 1 a 50 registros'
    USING ERRCODE='22023'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF jsonb_typeof(v_row)<>'object' THEN
      RAISE EXCEPTION 'Item do lote inválido' USING ERRCODE='22023'; END IF;
    v_reply:=public.eut_admin_catalog_upsert(
      v_row->>'origin',v_row->>'source_key',v_row->>'label',
      NULLIF(v_row->>'city_ibge','')::integer,
      v_row->>'category_slug',v_row->>'phone',_reason);
    IF v_reply->>'ok'<>'true' THEN
      RAISE EXCEPTION 'Lote contém origem conflitante'
        USING ERRCODE='23505'; END IF;
    v_results:=v_results||jsonb_build_array(v_reply);
  END LOOP;
  RETURN jsonb_build_object('ok',true,'processed',jsonb_array_length(v_results),
    'results',v_results,'published',false);
END;
$rpc$;

CREATE OR REPLACE FUNCTION public.eut_admin_catalog_set_enabled(
  _id uuid,_expected_updated_at timestamptz,_enabled boolean,_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $rpc$
DECLARE v_actor uuid:=auth.uid(); v_row public.technicians%ROWTYPE;
        v_reason text:=btrim(coalesce(_reason,''));v_changed boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT public.eut_account_operational()
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Administrador verificado obrigatório' USING ERRCODE='42501'; END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 400 OR
     v_reason ~* '(https?://|www[.]|wa[.]me|@|[+][0-9][0-9 ()-]{8,})'
  THEN RAISE EXCEPTION 'Motivo inválido' USING ERRCODE='22023'; END IF;
  IF _id IS NULL OR _expected_updated_at IS NULL OR _enabled IS NULL
  THEN RAISE EXCEPTION 'Identificador, versão e estado obrigatórios' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.technicians WHERE id=_id
    AND catalog_origin IN ('admin_manual','external_import','wordpress')
    AND user_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado' USING ERRCODE='P0002'; END IF;
  IF v_row.updated_at IS DISTINCT FROM _expected_updated_at
  THEN RAISE EXCEPTION 'Registro alterado em outra sessão' USING ERRCODE='40001'; END IF;
  IF _enabled AND EXISTS (
    SELECT 1 FROM eut_moderation.catalog_private_contacts c
    JOIN eut_moderation.blocked_phones b
      ON b.phone_digits=regexp_replace(c.phone_e164,'[^0-9]','','g')
    WHERE c.technician_id=_id
  ) THEN RAISE EXCEPTION 'Contato restrito' USING ERRCODE='42501'; END IF;
  v_changed:=v_row.catalog_enabled IS DISTINCT FROM _enabled;
  IF v_changed THEN
    -- Mandatory audit is written once by the catalog_enabled trigger.
    PERFORM pg_catalog.set_config('eut.catalog_change_reason',v_reason,true);
    UPDATE public.technicians SET catalog_enabled=_enabled WHERE id=_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'technician_id',_id,
    'changed',v_changed,'catalog_enabled',_enabled,'published',false);
END;
$rpc$;

REVOKE ALL ON FUNCTION public.eut_admin_catalog_upsert(text,text,text,integer,text,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_admin_catalog_import_batch(jsonb,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_admin_catalog_set_enabled(uuid,timestamptz,boolean,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_catalog_upsert(text,text,text,integer,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_catalog_import_batch(jsonb,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_catalog_set_enabled(uuid,timestamptz,boolean,text)
  TO authenticated;

-- Admin-only read path; never expose raw phone, source_key, user credentials,
-- or paid-contact status to the browser. Not a public catalog/read endpoint.
CREATE OR REPLACE FUNCTION public.eut_admin_catalog_list(
  _page integer DEFAULT 0,
  _limit integer DEFAULT 20,
  _search text DEFAULT '',
  _ids uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $rpc$
DECLARE
  v_actor uuid:=auth.uid();
  v_search text:=btrim(coalesce(_search,''));
  v_total integer:=0;
  v_rows jsonb:='[]'::jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT public.eut_account_operational()
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Administrador verificado obrigatório'
    USING ERRCODE='42501'; END IF;
  IF _page IS NULL OR _page NOT BETWEEN 0 AND 10000 OR
     _limit IS NULL OR _limit NOT BETWEEN 1 AND 50 OR
     length(v_search)>80 OR
     (_ids IS NOT NULL AND (cardinality(_ids)<1 OR cardinality(_ids)>50 OR
        array_position(_ids,NULL) IS NOT NULL))
  THEN RAISE EXCEPTION 'Parâmetros de consulta inválidos'
    USING ERRCODE='22023'; END IF;

  SELECT count(*)::integer INTO v_total FROM public.technicians t
   WHERE t.user_id IS NULL
     AND t.catalog_origin IN ('admin_manual','external_import','wordpress')
     AND (_ids IS NULL OR t.id=ANY(_ids))
     AND (v_search='' OR strpos(lower(coalesce(t.display_name,'')),lower(v_search))>0);

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id),'[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT t.id,t.display_name,t.city,t.state_uf,
      t.catalog_origin,t.catalog_enabled,t.status::text AS legacy_status,
      t.created_at,t.updated_at,
      EXISTS(SELECT 1 FROM eut_moderation.catalog_private_contacts pc
          WHERE pc.technician_id=t.id) AS has_private_contact,
      (SELECT max(l.id) FROM public.eut_admin_management_log l
        WHERE l.target_type='technician' AND l.target_key=t.id::text
          AND l.action IN ('catalog_created','catalog_enabled_changed')) AS last_audit_id
    FROM public.technicians t
    WHERE t.user_id IS NULL
      AND t.catalog_origin IN ('admin_manual','external_import','wordpress')
      AND (_ids IS NULL OR t.id=ANY(_ids))
      AND (v_search='' OR strpos(lower(coalesce(t.display_name,'')),lower(v_search))>0)
    ORDER BY t.created_at DESC,t.id
    LIMIT _limit OFFSET _page * _limit
  ) s;
  RETURN jsonb_build_object('ok',true,'page',_page,'limit',_limit,
    'total',v_total,'rows',v_rows);
END;
$rpc$;
REVOKE ALL ON FUNCTION public.eut_admin_catalog_list(integer,integer,text,uuid[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_catalog_list(integer,integer,text,uuid[])
 TO authenticated;

COMMIT;
