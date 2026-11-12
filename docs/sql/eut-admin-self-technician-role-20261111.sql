-- Encontre um Técnico: activation of a technician role on the SAME verified
-- administrative identity. Never assign or remove an administrator role.
-- Roll out separately from frontend, and test grants before deployment.
BEGIN;

CREATE OR REPLACE FUNCTION public.eut_admin_enable_my_technician_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  -- Caller must own a confirmed, active identity. The email and roles come
  -- from the auth database, NEVER from user-controlled metadata or arguments.
  IF eut_migration.confirmed_current_email() IS NULL THEN
    RAISE EXCEPTION 'Confirme sua identidade antes de habilitar o perfil técnico'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Conta restrita. Consulte o suporte'
      USING ERRCODE = '42501';
  END IF;

  -- Preserve the existing single-purpose choice between customer/technician.
  -- This function is specifically for admin + technician, not a universal
  -- role escalation endpoint. Never grant admin to a customer/technician.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'cliente'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Uma conta cliente exige tratamento separado para ativar o perfil técnico'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_uid, 'tecnico'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- The existing role trigger rejects blocked accounts and blocked phones.
  -- If auditing fails, the transaction must roll back the new role too.
  IF v_inserted = 1 THEN
    INSERT INTO public.eut_admin_management_log (
      actor_id, target_type, target_key, action, reason, before_state, after_state
    ) VALUES (
      v_uid, 'account', v_uid::text, 'self_enable_technician',
      'Administrador confirmou a ativação do próprio perfil profissional',
      jsonb_build_object('admin', true, 'tecnico', false),
      jsonb_build_object('admin', true, 'tecnico', true)
    );
  END IF;

  IF NOT public.has_role(v_uid, 'admin'::public.app_role)
    OR NOT public.has_role(v_uid, 'tecnico'::public.app_role) THEN
    RAISE EXCEPTION 'Permissões não foram confirmadas'
      USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'state', CASE WHEN v_inserted = 1 THEN 'activated' ELSE 'already_active' END,
    'admin_preserved', true, 'technician_enabled', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_admin_enable_my_technician_role()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_enable_my_technician_role()
  TO authenticated;
COMMIT;
