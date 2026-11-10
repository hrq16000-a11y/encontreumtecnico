-- Teste SQL de segurança com rollback. Não cria contas, não importa dados,
-- não publica contato, não transfere titularidade e não deixa reivindicações.
BEGIN;
DO $$
DECLARE
  v_admin uuid;
  v_good bigint;
  v_demo bigint;
BEGIN
  IF has_function_privilege('anon','public.eut_legacy_candidate_claimable(text,bigint)','EXECUTE')
     OR has_function_privilege('anon','public.eut_my_legacy_candidate_profiles()','EXECUTE')
  THEN RAISE EXCEPTION 'Anon pode consultar informações privadas'; END IF;
  IF NOT has_function_privilege('authenticated','public.eut_legacy_candidate_claimable(text,bigint)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.eut_my_legacy_candidate_profiles()','EXECUTE')
  THEN RAISE EXCEPTION 'RPCs de identidade indisponíveis para titular'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='legacy_profile_claims'
      AND cmd='INSERT'
      AND policyname='Verified technician or Google submits own pending claim'
      AND with_check LIKE '%eut_legacy_candidate_claimable%'
  ) THEN RAISE EXCEPTION 'RLS INSERT não verifica registros reais'; END IF;

  SELECT r.user_id INTO v_admin
  FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id
  WHERE r.role='admin'::public.app_role AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Conta administrativa verificada ausente'; END IF;

  SELECT d.wp_post_id INTO v_good
  FROM eut_migration.legacy_directory d
  JOIN public.legacy_review_profiles v
    ON v.source_key=d.source_key AND v.wp_post_id=d.wp_post_id
  LEFT JOIN public.eut_legacy_profile_management m
    ON m.source_key=d.source_key AND m.wp_post_id=d.wp_post_id
  WHERE d.kind='candidate' AND d.source_status='publish'
    AND d.source_approved=true AND v.demo_candidate=false
    AND coalesce(m.record_state,'pendente')<>'excluido'
  ORDER BY d.wp_post_id LIMIT 1;
  SELECT d.wp_post_id INTO v_demo
  FROM eut_migration.legacy_directory d
  JOIN public.legacy_review_profiles v
    ON v.source_key=d.source_key AND v.wp_post_id=d.wp_post_id
  WHERE d.kind='candidate' AND v.demo_candidate=true
  ORDER BY d.wp_post_id LIMIT 1;
  IF v_good IS NULL OR v_demo IS NULL THEN
    RAISE EXCEPTION 'Amostras de registro real e demo ausentes';
  END IF;

  PERFORM set_config('eut.test.real_wp',v_good::text,true);
  PERFORM set_config('eut.test.demo_wp',v_demo::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',v_admin::text,
      'app_metadata',jsonb_build_object(
        'provider','google','providers',jsonb_build_array('google')))::text,true);

  IF NOT public.eut_legacy_candidate_claimable('wordpress_20261108',v_good) THEN
    RAISE EXCEPTION 'Reivindicação legítima de ficha real indisponível';
  END IF;
  IF public.eut_legacy_candidate_claimable('wordpress_20261108',v_demo) THEN
    RAISE EXCEPTION 'Ficha demo aceita pela validação de reivindicação';
  END IF;
  IF public.eut_legacy_candidate_claimable('wordpress_20261108',9223372036854775807) THEN
    RAISE EXCEPTION 'Registro inexistente aceito';
  END IF;
  IF public.eut_legacy_candidate_claimable('outra_origem',v_good) THEN
    RAISE EXCEPTION 'Origem falsa aceita';
  END IF;
  IF EXISTS(SELECT 1 FROM public.eut_my_legacy_candidate_profiles()) THEN
    RAISE EXCEPTION 'Usuário admin recebeu sugestões privadas do técnico';
  END IF;
  RAISE NOTICE 'Validação positiva/negativa de perfis reais e demos: PASS';
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_admin uuid := current_setting('request.jwt.claim.sub',true)::uuid;
  v_good bigint := current_setting('eut.test.real_wp',true)::bigint;
  v_demo bigint := current_setting('eut.test.demo_wp',true)::bigint;
  v_ticket uuid;
  v_rejected boolean := false;
BEGIN
  -- Demonstração possui FK legítima, portanto a recusa depende da RLS.
  BEGIN
    INSERT INTO public.legacy_profile_claims
      (source_key,wp_post_id,claimant_id,claimant_note)
    VALUES('wordpress_20261108',v_demo,v_admin,'Teste negativo, revertido');
  EXCEPTION WHEN insufficient_privilege OR check_violation
    THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RLS deixou reivindicar demo'; END IF;

  -- Um cadastro legítimo PODE iniciar revisão sem vincular e sem publicar.
  INSERT INTO public.legacy_profile_claims
    (source_key,wp_post_id,claimant_id,claimant_note)
  VALUES('wordpress_20261108',v_good,v_admin,'Solicitação temporária de teste')
  RETURNING id INTO v_ticket;
  IF v_ticket IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.legacy_profile_claims
    WHERE id=v_ticket AND claimant_id=v_admin AND status='pendente'
  ) THEN RAISE EXCEPTION 'Reivindicação legítima não criou ticket pendente'; END IF;

  RAISE NOTICE 'RLS: demo negada e registro real apenas pendente; transação será revertida';
END;
$$;
ROLLBACK;
