-- Encontre um Técnico: ensaio de banco (não OAuth de navegador).
-- Cria 3 identidades e dados exclusivamente em transação ROLLBACK.
-- Verifica papel -> publicação -> pedido privado -> consentimento -> resposta -> cancelamento.
-- NÃO alterar IDs reais, não disparar WhatsApp, não publicar dados de demonstração.
BEGIN;

-- A preparação é realizada como função administrativa do teste. As ações de
-- técnico e cliente abaixo rodam com SET LOCAL ROLE authenticated e RLS real.
DO $seed$
DECLARE
  v_tech uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_id uuid;
  v_email text;
BEGIN
  FOREACH v_id IN ARRAY ARRAY[v_tech,v_client,v_other] LOOP
    v_email:='eut-rollback-'||v_id::text||'@example.invalid';
    INSERT INTO auth.users(id,instance_id,email,email_confirmed_at,raw_app_meta_data)
      VALUES(v_id,'00000000-0000-0000-0000-000000000000'::uuid,v_email,
       statement_timestamp(),'{"provider":"google","providers":["google"]}'::jsonb);
    INSERT INTO auth.identities(user_id,provider_id,provider,identity_data)
      VALUES(v_id,v_id::text,'google',
        jsonb_build_object('sub',v_id::text,'email',v_email,'email_verified',true));
  END LOOP;
  PERFORM set_config('eut.e2e.tech',v_tech::text,true);
  PERFORM set_config('eut.e2e.client',v_client::text,true);
  PERFORM set_config('eut.e2e.other',v_other::text,true);
  PERFORM set_config('eut.e2e.request',gen_random_uuid()::text,true);
  IF (SELECT count(*) FROM public.profiles WHERE id IN (v_tech,v_client,v_other))<>3 THEN
    RAISE EXCEPTION 'Novo usuário não recebeu perfil básico';
  END IF;
END
$seed$;

SET LOCAL ROLE authenticated;

DO $run$
DECLARE
  v_tech uuid:=current_setting('eut.e2e.tech',true)::uuid;
  v_client uuid:=current_setting('eut.e2e.client',true)::uuid;
  v_other uuid:=current_setting('eut.e2e.other',true)::uuid;
  v_req uuid:=current_setting('eut.e2e.request',true)::uuid;
  v_profile uuid;
  v_result jsonb;
  v_rejected boolean;
BEGIN
  -- Não é possível criar conta sem identidade autenticada e confirmada.
  PERFORM set_config('request.jwt.claim.sub','',true);
  v_rejected:=false;
  BEGIN
    PERFORM public.choose_account_type('tecnico'::public.app_role);
  EXCEPTION WHEN OTHERS THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Login ausente escolheu papel'; END IF;

  -- O técnico novo independe de qualquer perfil WordPress.
  PERFORM set_config('request.jwt.claim.sub',v_tech::text,true);
  PERFORM public.choose_account_type('tecnico'::public.app_role);
  v_result:=public.eut_publish_my_technician(
    'Profissional Temporário ROLLBACK','PR','Curitiba',
    ARRAY['redes']::text[],ARRAY['configuracao-wifi']::text[],
    'Centro','Curitiba','Diagnóstico de redes para teste reversível'
  );
  IF v_result->>'state'<>'publicado' THEN RAISE EXCEPTION 'Cadastro técnico não publicado'; END IF;
  v_profile:=(v_result->>'technician_id')::uuid;
  IF NOT EXISTS(
    SELECT 1 FROM public.technicians WHERE id=v_profile
       AND status='aprovado' AND state_uf='PR' AND city='Curitiba'
       AND 'configuracao-wifi'=ANY(service_slugs)
  ) THEN RAISE EXCEPTION 'Perfil não está na estrutura de busca'; END IF;

  -- Não pode usar serviço inválido nem trocar indevidamente o papel.
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_publish_my_technician(
      'Profissional Temporário ROLLBACK','PR','Curitiba',
      ARRAY['redes']::text[],ARRAY['especialidade-inexistente']::text[]
    );
  EXCEPTION WHEN OTHERS THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Serviço inexistente foi publicado'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.choose_account_type('cliente'::public.app_role);
  EXCEPTION WHEN OTHERS THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Técnico conseguiu virar cliente'; END IF;

  -- Cliente real teria Google OAuth; neste ensaio a identidade é simulada
  -- somente no banco e a assinatura é testada pelas mesmas RPCs e RLS.
  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  PERFORM public.choose_account_type('cliente'::public.app_role);
  INSERT INTO public.service_requests
    (id,client_id,technician_id,title,description,category,city,region)
  VALUES(v_req,v_client,v_profile,
    'Preciso configurar o Wi-Fi',
    'O roteador perde conexão periodicamente; solicito avaliação técnica.',
    'redes','Curitiba','Centro');
  IF (SELECT count(*) FROM public.service_requests WHERE id=v_req AND client_id=v_client)<>1
    THEN RAISE EXCEPTION 'Pedido privado do cliente não persistiu'; END IF;
  IF (SELECT count(*) FROM public.eut_direct_request_consents WHERE request_id=v_req)<>0
    THEN RAISE EXCEPTION 'Pedido salvo concedeu acesso automaticamente'; END IF;

  -- Antes do aceite o técnico não pode ler nem responder.
  PERFORM set_config('request.jwt.claim.sub',v_tech::text,true);
  IF (SELECT count(*) FROM public.service_requests WHERE id=v_req)<>0
    THEN RAISE EXCEPTION 'Técnico viu pedido sem consentimento'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_respond_to_direct_request(v_req,
      'Posso avaliar o roteador, verificando o sinal e a configuração.');
  EXCEPTION WHEN OTHERS THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Resposta sem consentimento aceita'; END IF;

  -- Terceiro não vê nem compartilha pedido alheio.
  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  IF (SELECT count(*) FROM public.service_requests WHERE id=v_req)<>0
    THEN RAISE EXCEPTION 'Terceiro viu o pedido alheio'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_share_direct_request(v_req);
  EXCEPTION WHEN OTHERS THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Terceiro compartilhou pedido alheio'; END IF;

  -- Compartilhamento individual opt-in; nenhuma liberação de telefone.
  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  v_result:=public.eut_share_direct_request(v_req);
  IF v_result->>'status'<>'enviado' THEN RAISE EXCEPTION 'Cliente não pôde consentir'; END IF;
  IF (SELECT count(*) FROM public.eut_direct_request_consents WHERE request_id=v_req)<>1
    THEN RAISE EXCEPTION 'Consentimento específico não persistiu'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_tech::text,true);
  IF (SELECT count(*) FROM public.service_requests WHERE id=v_req)<>1
    THEN RAISE EXCEPTION 'Técnico escolhido não pode ler pedido consentido'; END IF;
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_respond_to_direct_request(v_req,
      'Ligue para +55 41 99999-0000 para combinar diretamente.');
  EXCEPTION WHEN OTHERS THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Resposta com número privado aceita'; END IF;
  v_result:=public.eut_respond_to_direct_request(v_req,
    'Posso avaliar o roteador e verificar o sinal e a configuração nesta região.');
  IF v_result->>'status'<>'respondido'
    THEN RAISE EXCEPTION 'Resposta privada não registrada'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  IF (SELECT count(*) FROM public.eut_direct_request_replies WHERE request_id=v_req)<>1
    THEN RAISE EXCEPTION 'Cliente não pôde ler resposta privada'; END IF;
  PERFORM public.set_request_status(v_req,'cancelada'::public.request_status);
  IF (SELECT status FROM public.service_requests WHERE id=v_req)<>'cancelada'
    THEN RAISE EXCEPTION 'Cancelamento de cliente falhou'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_tech::text,true);
  IF (SELECT count(*) FROM public.service_requests WHERE id=v_req)<>0
    THEN RAISE EXCEPTION 'Cancelamento não encerrou leitura do técnico'; END IF;

  RAISE NOTICE 'PASS EUT: conta técnica+cliente, publicação, busca, privado, opt-in, resposta e cancelamento RLS';
END
$run$;

ROLLBACK;
