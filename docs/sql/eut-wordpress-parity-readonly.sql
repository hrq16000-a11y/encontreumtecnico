-- Auditoria READ ONLY da paridade WordPress; NÃO expõe telefone, email ou usuário.
-- Executar exclusivamente no projeto EUT autorizado, após cada rodada.
-- Não transformar cadastros WordPress importados em técnicos ativos sem titular.
SELECT metric, value FROM (
 SELECT 'wp_contas_importadas' metric, count(*)::bigint value FROM eut_migration.legacy_accounts
 UNION ALL SELECT 'wp_tecnicos_aguardando_titular',count(*) FROM eut_migration.account_activation_queue WHERE intended_type='tecnico' AND state='aguardando_titular'
 UNION ALL SELECT 'wp_clientes_aguardando_titular',count(*) FROM eut_migration.account_activation_queue WHERE intended_type='cliente' AND state='aguardando_titular'
 UNION ALL SELECT 'wp_admin_em_revisao',count(*) FROM eut_migration.account_activation_queue WHERE intended_type='admin_manual'
 UNION ALL SELECT 'diretorio_candidate',count(*) FROM eut_migration.legacy_directory WHERE kind='candidate'
 UNION ALL SELECT 'diretorio_employer',count(*) FROM eut_migration.legacy_directory WHERE kind='employer'
 UNION ALL SELECT 'diretorio_total',count(*) FROM eut_migration.legacy_directory
 UNION ALL SELECT 'rotas_legadas_total',count(*) FROM public.eut_legacy_url_routes
 UNION ALL SELECT 'rotas_legadas_em_validacao',count(*) FROM public.eut_legacy_url_routes WHERE status='em_validacao'
 UNION ALL SELECT 'acervo_publico_sanitizado',count(*) FROM public.legacy_public_archive
 UNION ALL SELECT 'acervo_com_contato_habilitado_ALERTA',count(*) FROM public.legacy_public_archive WHERE contact_enabled IS TRUE
 UNION ALL SELECT 'gerenciamento_legacy_pendente',count(*) FROM public.eut_legacy_profile_management WHERE record_state='pendente'
 UNION ALL SELECT 'demos_excluidas',count(*) FROM public.eut_legacy_profile_management WHERE record_state='excluido'
 UNION ALL SELECT 'media_total',count(*) FROM eut_migration.media_transfer_queue
 UNION ALL SELECT 'media_placeholder_ignorado',count(*) FROM eut_migration.media_transfer_queue WHERE transfer_state='ignorado_placeholder'
 UNION ALL SELECT 'media_pendente_analise',count(*) FROM eut_migration.media_transfer_queue WHERE transfer_state='pendente_analise'
 UNION ALL SELECT 'media_revisar_formato',count(*) FROM eut_migration.media_transfer_queue WHERE transfer_state='revisar_formato'
 UNION ALL SELECT 'media_hash_verificado',count(*) FROM eut_migration.media_transfer_queue WHERE verified_sha256 IS NOT NULL
 UNION ALL SELECT 'auth_contas_novas',count(*) FROM auth.users
 UNION ALL SELECT 'tecnicos_ativos',count(*) FROM public.technicians
 UNION ALL SELECT 'perfis_novos',count(*) FROM public.profiles
 UNION ALL SELECT 'demandas_novas',count(*) FROM public.service_requests
) AS counters ORDER BY metric;

-- Gates de segurança e prontidão para cutover, agregados e sem PII.
SELECT
 (SELECT count(*) FROM public.legacy_public_archive WHERE contact_enabled IS TRUE)=0
  AS acervo_sem_contato_privado,
 (SELECT count(*) FROM public.eut_legacy_profile_management WHERE record_state='excluido')>=20
  AS exclusao_demos_preservada,
 (SELECT count(*) FROM eut_migration.media_transfer_queue WHERE transfer_state='ignorado_placeholder')>=316
  AS placeholders_nao_publicaveis,
 (SELECT count(*) FROM public.technicians)>0
  AS existe_tecnico_real_ativo,
 (SELECT count(*) FROM public.service_requests)>0
  AS existe_demanda_real_registrada,
 (SELECT count(*) FROM public.eut_legacy_url_routes WHERE status='em_validacao')=0
  AS rotas_legadas_concluidas;

-- PASS de invariantes de privacidade NÃO significa paridade total.
-- Demais verificações exigem E2E humano, URL pública e validação de mídias reais.
