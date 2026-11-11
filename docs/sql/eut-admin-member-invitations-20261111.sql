-- EUT: convites para novos técnicos/clientes emitidos por administradores.
-- Não cria auth.users, não envia e-mail, não altera registros antigos, não libera admin.
-- Convite por e-mail confirmado; sem token no link ou no navegador.
BEGIN;

CREATE TABLE IF NOT EXISTS eut_moderation.member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL CHECK (
    email_normalized=lower(btrim(email_normalized)) AND
    char_length(email_normalized) BETWEEN 6 AND 254
  ),
  target_role public.app_role NOT NULL
    CHECK (target_role IN ('tecnico'::public.app_role,'cliente'::public.app_role)),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 400),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '72 hours'),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS eut_member_invite_one_pending_email
 ON eut_moderation.member_invitations(email_normalized) WHERE status='pending';
CREATE INDEX IF NOT EXISTS eut_member_invite_recent_admin
 ON eut_moderation.member_invitations(created_by,created_at DESC);
ALTER TABLE eut_moderation.member_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.member_invitations FROM PUBLIC,anon,authenticated;

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

    -- Prevent simultaneous creates for the same email.
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

CREATE OR REPLACE FUNCTION public.eut_admin_member_invites_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
DECLARE v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role)
     OR NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.created_at DESC),'[]'::jsonb)
    INTO v_rows FROM (
      SELECT id, target_role::text as target_role,
        left(split_part(email_normalized,'@',1),2)||'***@'||
          split_part(email_normalized,'@',2) as masked_email,
        CASE WHEN status='pending' AND expires_at<=now()
          THEN 'expired' ELSE status END as status,
        created_at,expires_at,accepted_at
      FROM eut_moderation.member_invitations
      ORDER BY created_at DESC LIMIT 50
    ) z;
  RETURN jsonb_build_object('invites',v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eut_my_member_invitation()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
DECLARE v_email text; v_role public.app_role; v_exp timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.eut_account_operational()
     OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid()) THEN
    RETURN jsonb_build_object('pending',false);
  END IF;
  v_email := lower(btrim(eut_migration.confirmed_current_email()));
  IF v_email IS NULL OR v_email='' THEN
    RETURN jsonb_build_object('pending',false);
  END IF;
  SELECT target_role,expires_at INTO v_role,v_exp
    FROM eut_moderation.member_invitations
    WHERE email_normalized=v_email AND status='pending' AND expires_at>now()
    ORDER BY created_at DESC LIMIT 1;
  IF v_role IS NULL THEN RETURN jsonb_build_object('pending',false); END IF;
  RETURN jsonb_build_object('pending',true,'target_role',v_role::text,'expires_at',v_exp);
END;
$function$;

CREATE OR REPLACE FUNCTION public.eut_accept_member_invitation()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_id uuid;
  v_role public.app_role;
BEGIN
  IF v_actor IS NULL OR NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Conta indisponível. Consulte o suporte' USING ERRCODE='42501';
  END IF;
  v_email := lower(btrim(eut_migration.confirmed_current_email()));
  IF v_email IS NULL OR v_email='' THEN
    RAISE EXCEPTION 'Confirme sua identidade antes de aceitar' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_actor)
     OR EXISTS(SELECT 1 FROM eut_migration.legacy_accounts
       WHERE lower(btrim(wp_email))=v_email) THEN
    RAISE EXCEPTION 'Conta existente exige recuperação ou gestão específica' USING ERRCODE='42501';
  END IF;
  SELECT id,target_role INTO v_id,v_role
    FROM eut_moderation.member_invitations
    WHERE email_normalized=v_email AND status='pending' AND expires_at>now()
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL OR v_role NOT IN ('tecnico'::public.app_role,'cliente'::public.app_role) THEN
    RAISE EXCEPTION 'Convite inexistente, expirado ou revogado' USING ERRCODE='42501';
  END IF;

  -- Existing trigger prevents role creation on blocked accounts/phones.
  INSERT INTO public.user_roles(user_id,role) VALUES(v_actor,v_role);
  UPDATE eut_moderation.member_invitations
    SET status='accepted',accepted_by=v_actor,accepted_at=now()
    WHERE id=v_id AND status='pending';
  INSERT INTO public.eut_admin_management_log
    (actor_id,target_type,target_key,action,reason,before_state,after_state)
    VALUES(v_actor,'account',v_id::text,'member_invite_accepted',
      'Convite aceito pelo titular do e-mail confirmado',
      jsonb_build_object('role',v_role::text,'pending',true),
      jsonb_build_object('role',v_role::text,'accepted',true));
  RETURN jsonb_build_object('ok',true,'state','accepted','target_role',v_role::text);
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_admin_member_invite_action(text,text,public.app_role,uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_admin_member_invites_snapshot()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_my_member_invitation()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_accept_member_invitation()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_member_invite_action(text,text,public.app_role,uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_member_invites_snapshot()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_my_member_invitation()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_accept_member_invitation()
  TO authenticated;

-- Grants are only to the functions; no new direct access to the private table.
DO $check$
BEGIN
 IF has_table_privilege('authenticated','eut_moderation.member_invitations','SELECT')
    OR has_table_privilege('authenticated','eut_moderation.member_invitations','INSERT')
    OR has_function_privilege('anon','public.eut_accept_member_invitation()','EXECUTE')
    OR has_function_privilege('anon','public.eut_admin_member_invite_action(text,text,public.app_role,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Convites sem isolamento de privilégios'; END IF;
END $check$;
COMMIT;
