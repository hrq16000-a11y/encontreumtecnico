-- Executar APÓS criação da função, ANTES de ativar o Auth Hook.
-- Apenas leitura da tabela e da função STABLE. Nenhum cadastro, UPDATE ou bloqueio real.
DO $smoke$
DECLARE
  v_email text;
  v_phone text;
  v_result jsonb;
BEGIN
  IF has_function_privilege('anon',
       'eut_moderation.before_user_created_guard(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'eut_moderation.before_user_created_guard(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('supabase_auth_admin',
       'eut_moderation.before_user_created_guard(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Hook exposto indevidamente';
  END IF;

  -- Inspeção neutra: não encontra a identidade com e-mail inédito.
  v_result := eut_moderation.before_user_created_guard(
    jsonb_build_object('user', jsonb_build_object(
      'email', 'eut-hook-qa-' || md5(random()::text) || '@example.invalid',
      'phone', ''
    )));
  IF v_result <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Recusou indevidamente um email de teste novo';
  END IF;

  -- Não usar telefone em user_metadata como prova de identidade.
  SELECT phone_digits INTO v_phone FROM eut_moderation.blocked_phones LIMIT 1;
  IF v_phone IS NOT NULL THEN
    v_result := eut_moderation.before_user_created_guard(
      jsonb_build_object('user', jsonb_build_object(
        'email', 'eut-hook-qa-' || md5(random()::text) || '@example.invalid',
        'phone', '',
        'user_metadata', jsonb_build_object('phone',v_phone)
      )));
    IF v_result <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Usou user_metadata como identidade confirmada';
    END IF;

    v_result := eut_moderation.before_user_created_guard(
      jsonb_build_object('user', jsonb_build_object('email','','phone',v_phone)));
    IF v_result->'error'->>'http_code' IS DISTINCT FROM '403' THEN
      RAISE EXCEPTION 'Falhou ao restringir telefone cadastrado no bloqueio';
    END IF;
  END IF;

  SELECT u.email INTO v_email
    FROM auth.users u
    JOIN eut_moderation.blocked_accounts b ON b.user_id=u.id
   WHERE u.email IS NOT NULL LIMIT 1;
  IF v_email IS NOT NULL THEN
    v_result := eut_moderation.before_user_created_guard(
      jsonb_build_object('user', jsonb_build_object('email',v_email,'phone','')));
    IF v_result->'error'->>'http_code' IS DISTINCT FROM '403' THEN
      RAISE EXCEPTION 'Falhou ao restringir email de conta banida';
    END IF;
  END IF;
END;
$smoke$;
