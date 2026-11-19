-- EUT: private administrative e-mail and structured address, without public exposure.
-- This augments the unified technician directory; it never modifies login email or suspended phones.
CREATE TABLE IF NOT EXISTS eut_moderation.admin_technician_identity (
  record_key text PRIMARY KEY,
  contact_email text,
  address_postal_code text,
  address_street text,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text,
  address_uf text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE eut_moderation.admin_technician_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.admin_technician_identity FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eut_admin_identity_get(_record_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_key text := btrim(coalesce(_record_key,''));
  v_exists boolean := false;
  v_email text;
  v_neighborhood text;
  v_city text;
  v_uf text;
  v_saved eut_moderation.admin_technician_identity%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Admin confirmado obrigatório' USING ERRCODE='42501'; END IF;

  IF v_key ~* '^registry:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT EXISTS(SELECT 1 FROM eut_moderation.admin_technician_records r
      WHERE r.id=substring(v_key from 10)::uuid) INTO v_exists;
    IF v_exists THEN
      SELECT l.contact_email INTO v_email
      FROM eut_moderation.admin_technician_records r
      JOIN eut_migration.legacy_directory l ON l.source_key='wordpress_20261108'
        AND l.wp_post_id=(CASE WHEN r.origin='wordpress' AND r.source_id ~ '^wordpress_20261108:[0-9]{1,9}$' THEN split_part(r.source_id,':',2)::bigint ELSE NULL END)
        AND l.kind='candidate'
      WHERE r.id=substring(v_key from 10)::uuid AND r.origin='wordpress'
        AND r.source_id ~ '^wordpress_20261108:[0-9]{1,9}$';
      IF v_email IS NULL THEN
        SELECT u.email INTO v_email
        FROM eut_moderation.admin_technician_records r
        JOIN public.technicians t ON t.id=r.portal_technician_id
        JOIN auth.users u ON u.id=t.user_id
        WHERE r.id=substring(v_key from 10)::uuid;
      END IF;
    END IF;
  ELSIF v_key ~* '^portal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT u.email,t.neighborhood,t.city,t.state_uf
      INTO v_email,v_neighborhood,v_city,v_uf
    FROM public.technicians t
    JOIN auth.users u ON u.id=t.user_id
    WHERE t.id=substring(v_key from 8)::uuid;
    v_exists:=FOUND;
  ELSIF v_key ~ '^wp:candidate:[0-9]{1,18}$' THEN
    SELECT l.contact_email INTO v_email FROM eut_migration.legacy_directory l
    WHERE l.source_key='wordpress_20261108' AND l.kind='candidate'
      AND l.wp_post_id=substring(v_key from 14)::bigint;
    v_exists:=FOUND;
  ELSE
    RETURN jsonb_build_object('ok',true,'available',false);
  END IF;

  IF NOT v_exists THEN RETURN jsonb_build_object('ok',true,'available',false); END IF;

  SELECT * INTO v_saved FROM eut_moderation.admin_technician_identity
    WHERE record_key=v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok',true,'available',true,
      'email',v_saved.contact_email,'postal_code',v_saved.address_postal_code,
      'street',v_saved.address_street,'number',v_saved.address_number,
      'complement',v_saved.address_complement,'neighborhood',v_saved.address_neighborhood,
      'city',v_saved.address_city,'uf',v_saved.address_uf,
      'updated_at',v_saved.updated_at);
  END IF;
  RETURN jsonb_build_object('ok',true,'available',true,
    'email',nullif(btrim(coalesce(v_email,'')),''),
    'postal_code',null,'street',null,'number',null,'complement',null,
    'neighborhood',nullif(btrim(coalesce(v_neighborhood,'')),''),
    'city',nullif(btrim(coalesce(v_city,'')),''),
    'uf',nullif(btrim(coalesce(v_uf,'')),''),
    'updated_at',null);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eut_admin_identity_save(
  _record_key text, _expected_updated_at timestamptz, _payload jsonb, _reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_key text := btrim(coalesce(_record_key,''));
  v_reason text := btrim(coalesce(_reason,''));
  v_current jsonb;
  v_before eut_moderation.admin_technician_identity%ROWTYPE;
  v_after eut_moderation.admin_technician_identity%ROWTYPE;
  v_email text;
  v_postal text;
  v_street text;
  v_number text;
  v_complement text;
  v_neighborhood text;
  v_city text;
  v_uf text;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Admin confirmado obrigatório' USING ERRCODE='42501'; END IF;
  IF length(v_reason) NOT BETWEEN 8 AND 400 OR
    v_reason ~* '(https?://|www[.]|wa[.]me|@|[+]?[0-9][0-9 ()-]{8,}[0-9])'
  THEN RAISE EXCEPTION 'Justificativa de alteração inválida' USING ERRCODE='22023'; END IF;

  v_current:=public.eut_admin_identity_get(v_key);
  IF (v_current->>'available') IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'Cadastro oficial não localizado' USING ERRCODE='22023'; END IF;

  IF _payload IS NULL OR jsonb_typeof(_payload)<>'object'
    OR NOT (_payload ?& ARRAY['email','postal_code','street','number','complement','neighborhood','city','uf'])
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(_payload) k WHERE k NOT IN
      ('email','postal_code','street','number','complement','neighborhood','city','uf'))
    OR EXISTS(SELECT 1 FROM jsonb_each(_payload) kv WHERE jsonb_typeof(kv.value) NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'Campos cadastrais inválidos' USING ERRCODE='22023'; END IF;

  v_email:=nullif(lower(btrim(_payload->>'email')),'');
  v_postal:=nullif(btrim(_payload->>'postal_code'),'');
  v_street:=nullif(btrim(_payload->>'street'),'');
  v_number:=nullif(btrim(_payload->>'number'),'');
  v_complement:=nullif(btrim(_payload->>'complement'),'');
  v_neighborhood:=nullif(btrim(_payload->>'neighborhood'),'');
  v_city:=nullif(btrim(_payload->>'city'),'');
  v_uf:=nullif(upper(btrim(_payload->>'uf')),'');

  IF (v_email IS NOT NULL AND (length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    OR (v_postal IS NOT NULL AND v_postal !~ '^[0-9]{8}$')
    OR length(coalesce(v_street,''))>200
    OR length(coalesce(v_number,''))>25
    OR length(coalesce(v_complement,''))>120
    OR length(coalesce(v_neighborhood,''))>120
    OR length(coalesce(v_city,''))>120
    OR (v_uf IS NOT NULL AND v_uf !~ '^[A-Z]{2}$')
  THEN RAISE EXCEPTION 'E-mail ou endereço inválido' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_before FROM eut_moderation.admin_technician_identity
    WHERE record_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_before.updated_at IS DISTINCT FROM _expected_updated_at
    THEN RAISE EXCEPTION 'Dados alterados por outro administrador' USING ERRCODE='40001'; END IF;
    UPDATE eut_moderation.admin_technician_identity SET
      contact_email=v_email,address_postal_code=v_postal,address_street=v_street,
      address_number=v_number,address_complement=v_complement,
      address_neighborhood=v_neighborhood,address_city=v_city,address_uf=v_uf,
      updated_at=clock_timestamp(),updated_by=v_actor
    WHERE record_key=v_key RETURNING * INTO v_after;
  ELSE
    IF _expected_updated_at IS NOT NULL
    THEN RAISE EXCEPTION 'Revisão cadastral desatualizada' USING ERRCODE='40001'; END IF;
    INSERT INTO eut_moderation.admin_technician_identity
      (record_key,contact_email,address_postal_code,address_street,address_number,
       address_complement,address_neighborhood,address_city,address_uf,updated_by)
    VALUES (v_key,v_email,v_postal,v_street,v_number,v_complement,
      v_neighborhood,v_city,v_uf,v_actor)
    RETURNING * INTO v_after;
  END IF;

  INSERT INTO public.eut_admin_management_log
    (actor_id,target_type,target_key,action,reason,before_state,after_state)
  VALUES (v_actor,'technician_identity',v_key,'technician_identity_updated',v_reason,
    jsonb_build_object('email_present',v_before.contact_email IS NOT NULL,
      'address_present',v_before.address_street IS NOT NULL),
    jsonb_build_object('email_present',v_email IS NOT NULL,
      'address_present',v_street IS NOT NULL,
      'email_changed',v_before.contact_email IS DISTINCT FROM v_email,
      'address_changed',row(v_before.address_postal_code,v_before.address_street,
        v_before.address_number,v_before.address_complement,v_before.address_neighborhood,
        v_before.address_city,v_before.address_uf)
        IS DISTINCT FROM row(v_postal,v_street,v_number,v_complement,v_neighborhood,v_city,v_uf)));
  RETURN jsonb_build_object('ok',true,'updated_at',v_after.updated_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_admin_identity_get(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_admin_identity_save(text,timestamptz,jsonb,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_identity_get(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_identity_save(text,timestamptz,jsonb,text)
  TO authenticated;