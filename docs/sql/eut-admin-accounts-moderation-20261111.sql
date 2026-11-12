-- EUT account moderation: reuse existing eut_moderation.blocked_accounts/blocked_phones
-- and public.eut_admin_contact_action. No auth.users deletion, role reassignment, DNS or contact publishing.
BEGIN;

-- A ban must stop NEW operational actions even when a user still holds a valid Google session.
-- Security definer only reads private moderation tables for the caller's OWN auth.uid().
CREATE OR REPLACE FUNCTION public.eut_account_operational()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog' AS $$
 SELECT auth.uid() IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=auth.uid())
  AND NOT EXISTS(SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE c.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.eut_account_operational() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_account_operational() TO authenticated;

DROP POLICY IF EXISTS eut_clients_not_restricted ON public.service_requests;
CREATE POLICY eut_clients_not_restricted ON public.service_requests
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.eut_account_operational()));

DROP POLICY IF EXISTS eut_new_technicians_not_restricted ON public.technicians;
CREATE POLICY eut_new_technicians_not_restricted ON public.technicians
 AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.eut_account_operational()));

-- SECURITY DEFINER choose_account_type() bypasses RLS. Protect role insertion using a trigger.
CREATE OR REPLACE FUNCTION eut_moderation.guard_new_role_for_blocked_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=NEW.user_id)
    OR EXISTS(SELECT 1 FROM public.eut_technician_private_contacts c
       JOIN eut_moderation.blocked_phones b
         ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
       WHERE c.user_id=NEW.user_id) THEN
   RAISE EXCEPTION 'Não foi possível concluir seu cadastro. Consulte o suporte.' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eut_guard_blocked_user_roles ON public.user_roles;
CREATE TRIGGER eut_guard_blocked_user_roles BEFORE INSERT ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_new_role_for_blocked_account();

-- Direct request RPC is SECURITY DEFINER, so protect its target table as well.
CREATE OR REPLACE FUNCTION eut_moderation.guard_blocked_direct_share()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=NEW.client_id)
    OR EXISTS(SELECT 1 FROM public.eut_technician_private_contacts c
       JOIN eut_moderation.blocked_phones b
       ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
       WHERE c.user_id=NEW.client_id) THEN
    RAISE EXCEPTION 'Não foi possível encaminhar sua solicitação. Consulte o suporte.' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eut_guard_blocked_direct_share ON public.eut_direct_request_consents;
CREATE TRIGGER eut_guard_blocked_direct_share BEFORE INSERT ON public.eut_direct_request_consents
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_blocked_direct_share();

-- Private admin-only directory of Supabase identities, regardless of technician/client roles.
-- No full email, no complete phone, no auth tokens, no passwords.
CREATE OR REPLACE FUNCTION public.eut_admin_accounts_snapshot(
  _search text DEFAULT '', _filter text DEFAULT 'todos', _page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $$
DECLARE v_search text:=left(lower(btrim(coalesce(_search,''))),80);
        v_filter text:=coalesce(_filter,'todos');
        v_page integer:=greatest(0,least(coalesce(_page,0),10000));
        v_total integer;
        v_rows jsonb:='[]'::jsonb;
        v_phones jsonb:='[]'::jsonb;
        v_audit jsonb:='[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso administrativo não autorizado' USING ERRCODE='42501'; END IF;
 IF v_filter NOT IN ('todos','tecnicos','clientes','sem_papel','bloqueados') THEN
  RAISE EXCEPTION 'Filtro inválido' USING ERRCODE='22023'; END IF;

 WITH base AS MATERIALIZED (
  SELECT u.id,u.created_at,
   coalesce(nullif(p.full_name,''),nullif(u.raw_user_meta_data->>'full_name',''),
            'Conta sem nome') AS full_name,
   coalesce(u.email,'') AS email,
   CASE WHEN u.email IS NULL THEN null
        ELSE left(split_part(u.email,'@',1),2)||'•••@'||split_part(u.email,'@',2) END AS masked_email,
   u.email_confirmed_at IS NOT NULL AS email_confirmed,
   coalesce((SELECT string_agg(r.role::text,', ' ORDER BY r.role::text)
      FROM public.user_roles r WHERE r.user_id=u.id),'') AS roles,
   EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='cliente'::public.app_role) AS is_client,
   EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='tecnico'::public.app_role) AS is_technician,
   EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin'::public.app_role) AS is_admin,
   t.id AS technician_id, t.status::text AS technician_status,
   CASE WHEN c.phone_e164 IS NULL THEN null ELSE '•••• '||right(c.phone_e164,4) END AS masked_phone,
   EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=u.id) AS blocked_account,
   EXISTS(SELECT 1 FROM eut_moderation.blocked_phones b
     WHERE b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')) AS blocked_phone
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id=u.id
  LEFT JOIN public.technicians t ON t.user_id=u.id
  LEFT JOIN public.eut_technician_private_contacts c ON c.user_id=u.id
 ),
 filtered AS MATERIALIZED (
  SELECT * FROM base b WHERE
   (v_search='' OR position(v_search IN lower(b.full_name))>0
     OR position(v_search IN lower(b.email))>0
     OR position(v_search IN b.id::text)>0
     OR position(regexp_replace(v_search,'[^0-9]','','g') IN
          regexp_replace(coalesce(b.masked_phone,''),'[^0-9]','','g'))>0
          AND regexp_replace(v_search,'[^0-9]','','g')<>'')
   AND (v_filter='todos'
    OR (v_filter='tecnicos' AND b.is_technician)
    OR (v_filter='clientes' AND b.is_client)
    OR (v_filter='sem_papel' AND b.roles='')
    OR (v_filter='bloqueados' AND (b.blocked_account OR b.blocked_phone)))
 )
 SELECT (SELECT count(*)::integer FROM filtered),
        coalesce((SELECT jsonb_agg(to_jsonb(z) ORDER BY z.created_at DESC)
          FROM (SELECT id,created_at,full_name,masked_email,email_confirmed,roles,
             is_client,is_technician,is_admin,technician_id,technician_status,masked_phone,
             blocked_account,blocked_phone
             FROM filtered ORDER BY created_at DESC LIMIT 20 OFFSET v_page*20) z),'[]'::jsonb)
 INTO v_total,v_rows;

 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.added_at DESC),'[]'::jsonb)
 INTO v_phones FROM (
  SELECT block_id AS id,'•••• '||right(phone_digits,4) AS masked_phone,
     added_at,reason_internal AS reason
  FROM eut_moderation.blocked_phones ORDER BY added_at DESC LIMIT 60) z;
 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.created_at DESC),'[]'::jsonb)
 INTO v_audit FROM (
  SELECT actor_id,action,subject_user_id,phone_last4,created_at,reason
  FROM eut_moderation.contact_audit
  UNION ALL
  SELECT actor_id,action,target_key::uuid AS subject_user_id,
    null::text AS phone_last4,created_at,reason
  FROM public.eut_admin_management_log WHERE target_type='account'
  ORDER BY created_at DESC LIMIT 40) z;
 RETURN jsonb_build_object('total',v_total,'page',v_page,'page_size',20,
                           'accounts',v_rows,'blocked_phones',v_phones,'audit',v_audit);
END $$;
REVOKE ALL ON FUNCTION public.eut_admin_accounts_snapshot(text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_accounts_snapshot(text,text,integer) TO authenticated;

-- Safe account edit: only display name. Never modify Google identity, email, roles or permissions.
ALTER TABLE public.eut_admin_management_log DROP CONSTRAINT IF EXISTS eut_admin_management_log_target_type_check;
ALTER TABLE public.eut_admin_management_log ADD CONSTRAINT eut_admin_management_log_target_type_check
 CHECK(target_type IN ('technician','legacy_review','account'));
CREATE OR REPLACE FUNCTION public.eut_admin_account_edit_name(
 _user_id uuid,_full_name text,_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog' AS $$
DECLARE v_actor uuid:=auth.uid(); v_name text:=btrim(coalesce(_full_name,''));
        v_reason text:=btrim(coalesce(_reason,'')); old_name text;
BEGIN
 IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso administrativo não autorizado' USING ERRCODE='42501'; END IF;
 IF _user_id IS NULL OR _user_id=v_actor OR
    EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=_user_id AND r.role='admin'::public.app_role) THEN
  RAISE EXCEPTION 'Conta administrativa protegida' USING ERRCODE='42501'; END IF;
 IF char_length(v_reason) NOT BETWEEN 8 AND 400 THEN RAISE EXCEPTION 'Justifique a edição (8 a 400 caracteres)' USING ERRCODE='22023'; END IF;
 IF char_length(v_name) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'Nome precisa ter de 3 a 100 caracteres' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_user_id) THEN
  RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE='P0002'; END IF;
 SELECT full_name INTO old_name FROM public.profiles WHERE id=_user_id FOR UPDATE;
 INSERT INTO public.profiles(id,full_name) VALUES(_user_id,v_name)
 ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name,updated_at=now();
 INSERT INTO public.eut_admin_management_log(actor_id,target_type,target_key,action,reason,before_state,after_state)
 VALUES(v_actor,'account',_user_id::text,'account_display_name',v_reason,
       jsonb_build_object('full_name',old_name),jsonb_build_object('full_name',v_name));
 RETURN jsonb_build_object('ok',true,'user_id',_user_id,'full_name',v_name);
END $$;
REVOKE ALL ON FUNCTION public.eut_admin_account_edit_name(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_account_edit_name(uuid,text,text) TO authenticated;

DO $$ BEGIN
 IF has_function_privilege('anon','public.eut_admin_accounts_snapshot(text,text,integer)','EXECUTE')
   OR has_function_privilege('anon','public.eut_admin_account_edit_name(uuid,text,text)','EXECUTE')
   OR has_function_privilege('anon','public.eut_account_operational()','EXECUTE')
   OR has_table_privilege('authenticated','public.eut_admin_management_log','INSERT') THEN
  RAISE EXCEPTION 'Unexpected public access to private moderation'; END IF;
END $$;
COMMIT;