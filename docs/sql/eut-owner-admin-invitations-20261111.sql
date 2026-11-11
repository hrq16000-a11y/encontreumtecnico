-- Encontre um Técnico: owner-only administrator invitations (PREPARATION ONLY)
-- Does NOT send mail, grant roles, change Auth settings or publish anything when committed.
-- Apply only AFTER isolated tests, with explicit production approval.
BEGIN;

CREATE TABLE IF NOT EXISTS eut_moderation.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized text NOT NULL CHECK (
    length(email_normalized) BETWEEN 6 AND 254
    AND email_normalized = lower(btrim(email_normalized))
  ),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 400),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revocation_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS eut_admin_invites_one_pending_per_email
 ON eut_moderation.admin_invitations (email_normalized)
 WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS eut_admin_invites_recent
 ON eut_moderation.admin_invitations(created_at DESC);
ALTER TABLE eut_moderation.admin_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.admin_invitations FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.admin_invite_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES eut_moderation.admin_invitations(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('created','accepted','revoked')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eut_moderation.admin_invite_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.admin_invite_audit FROM PUBLIC, anon, authenticated;

-- The bootstrap owner has a confirmed Google identity and an existing admin role.
-- Its claimed_user_id is currently null: do not fill it artificially or rely on it alone.
CREATE OR REPLACE FUNCTION eut_moderation.is_verified_invite_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
   SELECT 1 FROM auth.users u
   JOIN eut_migration.project_owner_bootstrap b
     ON lower(btrim(b.owner_email)) = lower(btrim(u.email))
   JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'::public.app_role
   WHERE u.id=auth.uid()
     AND u.email_confirmed_at IS NOT NULL
     AND (b.claimed_user_id IS NULL OR b.claimed_user_id=u.id)
     AND EXISTS(
       SELECT 1 FROM auth.identities i
       WHERE i.user_id=u.id AND i.provider='google'
         AND lower(coalesce(i.identity_data->>'email','')) = lower(u.email)
     )
 );
$$;
REVOKE ALL ON FUNCTION eut_moderation.is_verified_invite_owner()
 FROM PUBLIC, anon, authenticated;

-- Owner can create or revoke a pending invitation; invitation itself never grants a role.
CREATE OR REPLACE FUNCTION public.eut_owner_admin_invite_action(
  _action text, _target_email text DEFAULT NULL, _invite_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(coalesce(_target_email,'')));
  v_reason text := btrim(coalesce(_reason,''));
  v_id uuid;
  v_saved_status text;
BEGIN
  IF NOT eut_moderation.is_verified_invite_owner() THEN
    RAISE EXCEPTION 'Acesso exclusivo do proprietário verificado'
      USING ERRCODE='42501';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 8 AND 400 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (8 a 400 caracteres)'
      USING ERRCODE='22023';
  END IF;

  IF _action='create' THEN
    IF char_length(v_email) NOT BETWEEN 6 AND 254 OR
       v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
      RAISE EXCEPTION 'E-mail inválido' USING ERRCODE='22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id=v_actor AND lower(u.email)=v_email
    ) OR EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'::public.app_role
      WHERE lower(u.email)=v_email
    ) THEN
      RAISE EXCEPTION 'Esta identidade já possui acesso administrativo'
        USING ERRCODE='22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM auth.users u
      JOIN eut_moderation.blocked_accounts b ON b.user_id=u.id
      WHERE lower(u.email)=v_email
    ) OR EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.eut_technician_private_contacts c ON c.user_id=u.id
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE lower(u.email)=v_email
    ) THEN
      RAISE EXCEPTION 'Identidade não elegível. Consulte a moderação.'
        USING ERRCODE='42501';
    END IF;

    UPDATE eut_moderation.admin_invitations
       SET status='expired'
     WHERE email_normalized=v_email
       AND status='pending' AND expires_at<=now();

    IF (SELECT count(*) FROM eut_moderation.admin_invitations
        WHERE status='pending' AND expires_at>now()) >= 20 THEN
      RAISE EXCEPTION 'Limite de convites pendentes atingido'
        USING ERRCODE='22023';
    END IF;
    INSERT INTO eut_moderation.admin_invitations(email_normalized,created_by,reason)
    VALUES(v_email,v_actor,v_reason)
    RETURNING id INTO v_id;
    INSERT INTO eut_moderation.admin_invite_audit(invitation_id,actor_id,action,reason)
    VALUES(v_id,v_actor,'created',v_reason);
    RETURN jsonb_build_object('ok',true,'action','create','id',v_id);
  ELSIF _action='revoke' THEN
    IF _invite_id IS NULL THEN
      RAISE EXCEPTION 'Identificador do convite obrigatório' USING ERRCODE='22023';
    END IF;
    SELECT id,status INTO v_id,v_saved_status FROM eut_moderation.admin_invitations
    WHERE id=_invite_id FOR UPDATE;
    IF v_id IS NULL OR v_saved_status <> 'pending' THEN
      RAISE EXCEPTION 'Convite não está pendente' USING ERRCODE='22023';
    END IF;
    UPDATE eut_moderation.admin_invitations
      SET status='revoked',revoked_by=v_actor,revoked_at=now(),revocation_reason=v_reason
      WHERE id=v_id;
    INSERT INTO eut_moderation.admin_invite_audit(invitation_id,actor_id,action,reason)
    VALUES(v_id,v_actor,'revoked',v_reason);
    RETURN jsonb_build_object('ok',true,'action','revoke','id',v_id);
  END IF;
  RAISE EXCEPTION 'Ação inválida' USING ERRCODE='22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.eut_owner_admin_invites_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_rows jsonb;
BEGIN
 IF NOT eut_moderation.is_verified_invite_owner() THEN
   RAISE EXCEPTION 'Acesso exclusivo do proprietário verificado' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),'[]'::jsonb)
 INTO v_rows FROM (
   SELECT id,email_normalized,status,created_at,expires_at,accepted_at,revoked_at
   FROM eut_moderation.admin_invitations ORDER BY created_at DESC LIMIT 50
 ) t;
 RETURN jsonb_build_object('invites',v_rows);
END;
$$;

-- The recipient sees only the invitation for their own verified email.
CREATE OR REPLACE FUNCTION public.eut_my_admin_invitation()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_email text; v_id uuid; v_exp timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RETURN '{}'::jsonb; END IF;
 SELECT lower(email) INTO v_email FROM auth.users
 WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN RETURN '{}'::jsonb; END IF;
 SELECT id,expires_at INTO v_id,v_exp
 FROM eut_moderation.admin_invitations
 WHERE email_normalized=v_email AND status='pending' AND expires_at>now()
 ORDER BY created_at DESC LIMIT 1;
 IF v_id IS NULL THEN RETURN '{}'::jsonb; END IF;
 RETURN jsonb_build_object('id',v_id,'expires_at',v_exp,'pending',true);
END;
$$;

-- Redemption is locked and atomic. No metadata, URL token or browser-supplied role is trusted.
CREATE OR REPLACE FUNCTION public.eut_accept_admin_invitation(_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_actor uuid := auth.uid(); v_email text; v_id uuid;
BEGIN
 IF v_actor IS NULL OR _invite_id IS NULL THEN
   RAISE EXCEPTION 'Entre com seu e-mail verificado' USING ERRCODE='42501';
 END IF;
 SELECT lower(email) INTO v_email FROM auth.users
 WHERE id=v_actor AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN
   RAISE EXCEPTION 'Confirme o e-mail para aceitar o convite' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts WHERE user_id=v_actor)
    OR EXISTS(
      SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE c.user_id=v_actor
    ) THEN
   RAISE EXCEPTION 'Acesso indisponível. Consulte o suporte.' USING ERRCODE='42501';
 END IF;

 SELECT id INTO v_id FROM eut_moderation.admin_invitations
 WHERE id=_invite_id AND email_normalized=v_email
   AND status='pending' AND expires_at>now()
 FOR UPDATE;
 IF v_id IS NULL THEN
   RAISE EXCEPTION 'Convite inválido ou expirado' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.user_roles(user_id,role)
 VALUES(v_actor,'admin'::public.app_role)
 ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE eut_moderation.admin_invitations
   SET status='accepted',accepted_by=v_actor,accepted_at=now()
 WHERE id=v_id AND status='pending';
 INSERT INTO eut_moderation.admin_invite_audit(invitation_id,actor_id,action,reason)
 VALUES(v_id,v_actor,'accepted','Aceite pelo destinatário autenticado e verificado');
 RETURN jsonb_build_object('ok',true,'accepted',true);
END;
$$;

REVOKE ALL ON FUNCTION public.eut_owner_admin_invite_action(text,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_owner_admin_invites_snapshot()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_my_admin_invitation()
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eut_accept_admin_invitation(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_owner_admin_invite_action(text,text,uuid,text)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_owner_admin_invites_snapshot()
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_my_admin_invitation()
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.eut_accept_admin_invitation(uuid)
 TO authenticated;

DO $$
BEGIN
 IF has_function_privilege('anon','public.eut_owner_admin_invite_action(text,text,uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.eut_accept_admin_invitation(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','eut_moderation.is_verified_invite_owner()','EXECUTE')
 OR has_table_privilege('authenticated','eut_moderation.admin_invitations','INSERT')
 OR has_table_privilege('authenticated','eut_moderation.admin_invite_audit','INSERT') THEN
   RAISE EXCEPTION 'Permissões inseguras de convite administrativo';
 END IF;
END $$;
COMMIT;
