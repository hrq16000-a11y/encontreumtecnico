-- Complementary hardening of PR #173. No invite or account changes.
-- Only replace the existing protected RPC; grants/guards stay unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.eut_admin_member_invite_action(
  _action text, _email text DEFAULT NULL, _role public.app_role DEFAULT NULL,
  _invite_id uuid DEFAULT NULL, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(coalesce(_email,'')));
  v_reason text := btrim(coalesce(_reason,''));
  v_id uuid;
  v_role public.app_role;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
     OR eut_migration.confirmed_current_email() IS NULL
     OR NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado' USING ERRCODE='42501';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 400 THEN
    RAISE EXCEPTION 'Motivo administrativo obrigatório (8 a 400 caracteres)' USING ERRCODE='22023';
  END IF;

  IF _action='create' THEN
    IF _role IS NULL OR _role NOT IN ('tecnico'::public.app_role,'cliente'::public.app_role) THEN
      RAISE EXCEPTION 'Tipo de conta inválido' USING ERRCODE='22023';
    END IF;
    IF char_length(v_email) NOT BETWEEN 6 AND 254 OR
       v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
      RAISE EXCEPTION 'E-mail inválido' USING ERRCODE='22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM eut_migration.legacy_accounts l
      WHERE lower(btrim(l.wp_email))=v_email
    ) THEN
      RAISE EXCEPTION 'Cadastro histórico exige recuperação, não convite novo' USING ERRCODE='42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id=u.id
      WHERE lower(btrim(u.email))=v_email
    ) THEN
      RAISE EXCEPTION 'Conta existente deve ser administrada, não recriada por convite'
        USING ERRCODE='22023';
    END IF;
    IF EXISTS(
      SELECT 1 FROM auth.users u JOIN eut_moderation.blocked_accounts b ON b.user_id=u.id
      WHERE lower(btrim(u.email))=v_email
    ) OR EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.eut_technician_private_contacts c ON c.user_id=u.id
      JOIN eut_moderation.blocked_phones b ON b.phone_digits=
        regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE lower(btrim(u.email))=v_email
    ) THEN
      RAISE EXCEPTION 'Identidade restrita. Consulte o suporte' USING ERRCODE='42501';
    END IF;

    -- Serialize invitations across distinct recipients for the SAME admin,
    -- avoiding a race that could exceed 20 creations in 24h.
    -- Lock ordering: actor first, email second, to prevent deadlocks.
    PERFORM pg_advisory_xact_lock(hashtext('eut-member-invite-actor:'||v_actor::text));
    PERFORM pg_advisory_xact_lock(hashtext('eut-member-invite:'||v_email));
    UPDATE eut_moderation.member_invitations
      SET status='expired'
      WHERE email_normalized=v_email AND status='pending' AND expires_at<=now();
    IF EXISTS(SELECT 1 FROM eut_moderation.member_invitations
      WHERE email_normalized=v_email AND status='pending') THEN
      RAISE EXCEPTION 'Já existe um convite pendente para este e-mail' USING ERRCODE='22023';
    END IF;
    IF (SELECT count(*) FROM eut_moderation.member_invitations
        WHERE created_by=v_actor AND created_at>now()-interval '24 hours')>=20
       OR (SELECT count(*) FROM eut_moderation.member_invitations
        WHERE created_by=v_actor AND status='pending' AND expires_at>now())>=20 THEN
      RAISE EXCEPTION 'Limite de convites atingido. Tente mais tarde' USING ERRCODE='22023';
    END IF;

    INSERT INTO eut_moderation.member_invitations
      (email_normalized,target_role,created_by,reason)
      VALUES(v_email,_role,v_actor,v_reason)
      RETURNING id INTO v_id;
    INSERT INTO public.eut_admin_management_log
      (actor_id,target_type,target_key,action,reason,before_state,after_state)
      VALUES(v_actor,'account',v_id::text,'member_invite_created',v_reason,
        '{}'::jsonb,jsonb_build_object('role',_role::text,'pending',true));
    RETURN jsonb_build_object('ok',true,'action','create','invite_id',v_id,
      'target_role',_role::text,'expires_in_hours',72);

  ELSIF _action='revoke' THEN
    SELECT id,target_role INTO v_id,v_role FROM eut_moderation.member_invitations
      WHERE id=_invite_id AND status='pending' FOR UPDATE;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Convite indisponível ou já finalizado' USING ERRCODE='22023';
    END IF;
    UPDATE eut_moderation.member_invitations
      SET status='revoked',revoked_by=v_actor,revoked_at=now()
      WHERE id=v_id;
    INSERT INTO public.eut_admin_management_log
      (actor_id,target_type,target_key,action,reason,before_state,after_state)
      VALUES(v_actor,'account',v_id::text,'member_invite_revoked',v_reason,
        jsonb_build_object('role',v_role::text,'pending',true),
        jsonb_build_object('role',v_role::text,'revoked',true));
    RETURN jsonb_build_object('ok',true,'action','revoke','invite_id',v_id);
  END IF;
  RAISE EXCEPTION 'Ação inválida' USING ERRCODE='22023';
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_admin_member_invite_action(text,text,public.app_role,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_member_invite_action(text,text,public.app_role,uuid,text)
  TO authenticated;

DO $check$
BEGIN
  IF has_function_privilege('anon','public.eut_admin_member_invite_action(text,text,public.app_role,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Invitations must not be executable by anonymous users';
  END IF;
END $check$;
COMMIT;
