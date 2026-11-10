-- EUT | Diagnóstico seguro do fluxo completo, somente leitura.
-- Não cria contas, técnicos, pedidos ou contatos; não prova OAuth E2E.
-- Executar no Supabase correto, comparando resultados após cada release.
SELECT
  (SELECT count(*) FROM auth.users) AS usuarios_auth,
  (SELECT count(*) FROM public.user_roles WHERE role='tecnico') AS contas_tecnicas,
  (SELECT count(*) FROM public.user_roles WHERE role='cliente') AS contas_cliente,
  (SELECT count(*) FROM public.technicians WHERE status='aprovado') AS tecnicos_publicados,
  (SELECT count(*) FROM public.service_requests) AS pedidos_cadastrados,
  (SELECT count(*) FROM public.eut_direct_request_consents) AS compartilhamentos_consentidos,
  (SELECT count(*) FROM public.eut_direct_request_replies) AS respostas_privadas,
  (SELECT count(*) FROM public.eut_technician_private_contacts) AS telefones_privados_cadastrados,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename='service_requests' AND cmd='SELECT'
     AND policyname='Technician reads only explicitly shared direct requests'
     AND qual LIKE '%eut_direct_request_consents%')>0 AS rls_tecnico_exige_consentimento,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename='service_requests' AND cmd='INSERT'
     AND policyname='Client opens' AND with_check LIKE '%client_id%')>0
     AS rls_pedido_somente_pelo_cliente,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public'
     AND tablename='eut_direct_request_replies' AND cmd='SELECT'
     AND policyname LIKE 'Client reads reply only%')>0
     AS rls_resposta_exige_compartilhamento,
  to_regprocedure('public.choose_account_type(public.app_role)') IS NOT NULL
     AS rpc_cadastro_existe,
  to_regprocedure('public.eut_publish_my_technician(text,text,text,text[],text[],text,text,text)')
     IS NOT NULL AS rpc_publicacao_existe,
  to_regprocedure('public.eut_share_direct_request(uuid)') IS NOT NULL
     AS rpc_compartilhamento_existe,
  to_regprocedure('public.eut_respond_to_direct_request(uuid,text)') IS NOT NULL
     AS rpc_resposta_existe,
  NOT has_function_privilege('anon','public.eut_share_direct_request(uuid)','EXECUTE')
     AS anon_impedido_de_compartilhar,
  NOT has_function_privilege('anon','public.eut_respond_to_direct_request(uuid,text)','EXECUTE')
     AS anon_impedido_de_responder,
  FALSE AS oauth_duas_contas_homologado,
  FALSE AS e2e_pedido_real_homologado,
  FALSE AS dns_cutover_autorizado;
