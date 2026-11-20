-- EUT | Proposta isolada: o papel de técnico novo exige a mesma prova de
-- identidade já exigida por public.eut_publish_my_technician.
-- NÃO EXECUTAR sem autorização específica, revisão do contrato instalado e
-- janela de aplicação auditada. Não altera contas existentes nem RLS.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.choose_account_type(public.app_role)') IS NULL
     OR to_regprocedure('eut_migration.confirmed_current_email()') IS NULL THEN
    RAISE EXCEPTION 'Contratos de identidade esperados indisponíveis';
  END IF;
  IF (SELECT md5(pg_get_functiondef(p.oid))
      FROM pg_proc p
      WHERE p.oid=to_regprocedure('public.choose_account_type(public.app_role)'))
      IS DISTINCT FROM 'b3bc27956ff5d233c042372a20e309df' THEN
    RAISE EXCEPTION 'RPC de escolha divergiu da versão auditada; revisar antes de aplicar';
  END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.choose_account_type(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'auth', 'public', 'eut_migration'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_legacy_type text;
  v_prior_link uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF _role NOT IN ('tecnico'::public.app_role,'cliente'::public.app_role) THEN
    RAISE EXCEPTION 'invalid account type';
  END IF;

  -- Preserve the installed baseline: Supabase verified email plus matching
  -- server-side identity, never client-editable identity hints.
  SELECT lower(btrim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id=v_user AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.user_id=u.id AND i.provider IN ('email','google')
        AND lower(btrim(coalesce(i.identity_data->>'email','')))=lower(btrim(u.email))
        AND (i.provider <> 'google'
             OR coalesce(i.identity_data->>'email_verified','true') <> 'false')
    );
  IF v_email IS NULL THEN RAISE EXCEPTION 'verified identity required'; END IF;

  SELECT q.intended_type,q.linked_auth_user_id INTO v_legacy_type,v_prior_link
  FROM eut_migration.account_activation_queue q
  JOIN eut_migration.legacy_accounts a
    ON a.source_key=q.source_key AND a.wp_user_id=q.wp_user_id
  WHERE lower(btrim(a.wp_email))=v_email
  LIMIT 1;

  IF v_legacy_type='admin_manual' THEN
    RAISE EXCEPTION 'legacy administrator requires dedicated recovery';
  END IF;
  IF v_prior_link IS NOT NULL AND v_prior_link<>v_user THEN
    RAISE EXCEPTION 'imported account is associated with another identity';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles r
             WHERE r.user_id=v_user AND r.role<>_role) THEN
    RAISE EXCEPTION 'account type has already been selected';
  END IF;

  -- Only NEW technician roles need this stricter proof. Existing selection
  -- remains idempotent, and client-role behavior is preserved. An automatically
  -- confirmed email without proof of delivery must not enter the publish flow.
  IF _role='tecnico'::public.app_role
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r
                    WHERE r.user_id=v_user AND r.role=_role)
    AND eut_migration.confirmed_current_email() IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'technician identity needs verified email proof'
      USING ERRCODE='42501';
  END IF;

  INSERT INTO public.user_roles(user_id,role)
  VALUES (v_user,_role)
  ON CONFLICT (user_id,role) DO NOTHING;
END;
$function$;

-- CREATE OR REPLACE conserva o ACL da função existente. Não conceder ou
-- revogar permissões incidentalmente nesta correção de contrato.
DO $check$
BEGIN
  IF has_function_privilege('anon','public.choose_account_type(public.app_role)','EXECUTE') THEN
    RAISE EXCEPTION 'Anon não pode selecionar papel de conta';
  END IF;
  IF NOT has_function_privilege('authenticated','public.choose_account_type(public.app_role)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.choose_account_type(public.app_role)','EXECUTE') THEN
    RAISE EXCEPTION 'ACL de execução original deve permanecer intacto';
  END IF;
END $check$;
COMMIT;
