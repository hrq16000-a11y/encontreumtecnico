-- PROPOSTA AUDITADA; NAO EXECUTAR AUTOMATICAMENTE EM PRODUCAO.
-- Retira a comprovacao adicional por e-mail/SMS APENAS do autosservico tecnico.
-- Auth.uid(), papel tecnico, conta operacional, RLS, suspensoes e historicos
-- continuam obrigatorios. Nao altera eut_migration.confirmed_current_email(),
-- ainda usada por fluxos independentes de titularidade, convite e pagamento.
-- Preflight: os oito hashes sao do projeto pqtzhctvjbfcunmrvxne em 20/11/2026.
-- Qualquer alteracao concorrente cancela TODO o lote antes da primeira escrita.

BEGIN;
DO $patch$
DECLARE
  entry record;
  current_def text;
  revised_def text;
  stored_defs text[] := ARRAY[]::text[];
  definitions text[] := ARRAY[]::text[];
BEGIN
  -- A política de edição do titular precisa corresponder ao contrato oficial
  -- auditado. A política administrativa deve continuar independente.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'technicians'
      AND p.policyname = 'Owner edits back to pending'
      AND p.cmd = 'UPDATE' AND p.permissive = 'PERMISSIVE'
      AND p.roles = ARRAY['authenticated']::name[]
      AND p.qual = '(auth.uid() = user_id)'
      AND p.with_check = '((auth.uid() = user_id) AND (status = ''pendente''::approval_status))'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'technicians'
      AND p.policyname = 'Admin moderates'
      AND p.cmd = 'UPDATE' AND p.permissive = 'PERMISSIVE'
      AND p.roles = ARRAY['authenticated']::name[]
      AND p.qual = 'has_role(auth.uid(), ''admin''::app_role)'
      AND p.with_check = 'has_role(auth.uid(), ''admin''::app_role)'
  ) THEN
    RAISE EXCEPTION 'Politicas de edicao ou moderacao divergentes: interromper ativacao';
  END IF;

  FOR entry IN SELECT * FROM (VALUES
    ('public.eut_admin_enable_my_technician_role()', 'af740e9d409d43155568b701a57ea76f'),
    ('public.eut_my_private_contact()', '93b3e8752ba858eff6c9167a1e42807b'),
    ('public.eut_publish_my_technician(text,text,text,text[],text[],text,text,text)', 'f49ce9a033492fd96edcd6c9124551db'),
    ('public.eut_remove_my_private_contact()', 'e0d5aa6d2cce53ebd4477fc2adac63af'),
    ('public.eut_save_my_private_contact(text,boolean)', '537675b6075084cec305accfcce3fb79'),
    ('public.eut_set_my_presence(boolean)', 'af98b668d37d118d6b7a0aaf7c34272a'),
    ('public.eut_set_my_technician_avatar(text)', 'b840a776795d6b19ff35ad0b674526d7'),
    ('public.eut_set_my_technician_coverage(integer,integer[])', '18a3454b7ecae321d1cb169ab9478c15')
  ) AS expected(signature, hash)
  LOOP
    SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(entry.signature)) INTO current_def;
    IF current_def IS NULL OR md5(current_def) <> entry.hash THEN
      RAISE EXCEPTION 'Autosservico alterado desde a auditoria: %; revisar antes de aplicar', entry.signature;
    END IF;
    -- A substituicao e limitada ao teste IS NULL: nenhuma outra chamada do helper
    -- (nem sua propria definicao) e alterada. Preserva integralmente o corpo RPC.
    revised_def := pg_catalog.regexp_replace(current_def,
      'eut_migration[.]confirmed_current_email[(][)][[:space:]]+is[[:space:]]+null',
      'NOT public.eut_account_operational()', 'gi');
    IF revised_def = current_def OR
       pg_catalog.strpos(pg_catalog.lower(revised_def), 'confirmed_current_email()') > 0 THEN
      RAISE EXCEPTION 'Guarda inesperada na funcao %', entry.signature;
    END IF;
    revised_def := pg_catalog.replace(revised_def,
      'confirmed technician session required', 'authenticated technician session required');
    revised_def := pg_catalog.replace(revised_def,
      'verified technician account required', 'authenticated technician account required');
    revised_def := pg_catalog.replace(revised_def,
      'Confirme sua identidade antes de habilitar o perfil técnico',
      'Conta indisponível para ativação do perfil técnico');

    -- A remocao do bloqueio por e-mail nao pode permitir habilitar ou trocar
    -- telefone comercial em ficha suspensa/rejeitada. A consulta e a remocao
    -- do proprio contato continuam disponiveis por privacidade.
    IF entry.signature = 'public.eut_save_my_private_contact(text,boolean)' THEN
      IF pg_catalog.strpos(revised_def, '  if _allow_paid_contact is null then') = 0 THEN
        RAISE EXCEPTION 'Ancora de protecao do contato mudou: %', entry.signature;
      END IF;
      revised_def := pg_catalog.replace(revised_def,
        '  if _allow_paid_contact is null then',
        $guard$  if exists (
    select 1 from public.technicians t
    where t.user_id = v_user
      and t.status in ('suspenso'::public.approval_status, 'rejeitado'::public.approval_status)
    for update
  ) then
    raise exception 'Ficha suspensa ou rejeitada: contato privado protegido'
      using errcode = '42501';
  end if;
  if _allow_paid_contact is null then$guard$);
    END IF;
    definitions := pg_catalog.array_append(definitions, revised_def);
  END LOOP;
  -- Escrita apenas apos TODAS as oito definicoes terem passado o preflight.
  FOREACH revised_def IN ARRAY definitions LOOP
    EXECUTE revised_def;
  END LOOP;
END;
$patch$;

-- Impede que o proprio titular retire a suspensao/rejeicao via UPDATE
-- direto. Nao modifica "Admin moderates" nem o WITH CHECK original.
ALTER POLICY "Owner edits back to pending" ON public.technicians
  USING (
    auth.uid() = user_id
    AND status NOT IN ('suspenso'::public.approval_status, 'rejeitado'::public.approval_status)
  );

-- Exclusao solicitada pelo proprio titular: preserva a chave tecnica para
-- historicos de solicitacao, pagamentos, moderacao e Pioneiros. Nao executa
-- DELETE na tabela technicians, cujas FKs incluem historicos RESTRICT/CASCADE.
-- Nao remove a conta Auth. Um novo preenchimento pode reutilizar a mesma ficha.
CREATE OR REPLACE FUNCTION public.eut_remove_my_technician_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_status public.approval_status;
  v_display_name text;
BEGIN
  IF v_user IS NULL OR NOT public.eut_account_operational() OR NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = v_user AND r.role = 'tecnico'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Conta tecnica autenticada e ativa obrigatoria' USING ERRCODE = '42501';
  END IF;

  SELECT t.id, t.status, t.display_name INTO v_id, v_status, v_display_name
  FROM public.technicians t WHERE t.user_id = v_user FOR UPDATE;
  IF v_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('state', 'nao_encontrado');
  END IF;
  IF v_status IN ('suspenso'::public.approval_status, 'rejeitado'::public.approval_status) THEN
    RAISE EXCEPTION 'Ficha restrita: somente o suporte pode alterar o estado'
      USING ERRCODE = '42501';
  END IF;
  IF v_status = 'pendente'::public.approval_status AND v_display_name = 'Ficha excluída'
    AND NOT EXISTS (SELECT 1 FROM public.eut_technician_private_contacts c WHERE c.user_id = v_user)
  THEN
    RETURN pg_catalog.jsonb_build_object('state', 'removido', 'technician_id', v_id);
  END IF;

  UPDATE public.technicians SET
    status = 'pendente'::public.approval_status,
    display_name = 'Ficha excluída', city = 'Não informado', state_uf = NULL,
    neighborhood = NULL, region = NULL, bio = NULL,
    specialties = '{}'::text[], service_slugs = '{}'::text[],
    avatar_path = NULL, coverage_city_ids = '{}'::integer[],
    service_radius_km = NULL
  WHERE id = v_id AND user_id = v_user;

  DELETE FROM public.eut_technician_private_contacts WHERE user_id = v_user;
  INSERT INTO public.eut_admin_management_log (
    actor_id, target_type, target_key, action, reason, before_state, after_state
  ) VALUES (
    v_user, 'technician', v_id::text, 'technician_self_remove',
    'Titular removeu propria ficha publica; conta e historicos protegidos',
    pg_catalog.jsonb_build_object('status', v_status::text),
    pg_catalog.jsonb_build_object('status', 'pendente', 'public_profile', 'removed')
  );
  RETURN pg_catalog.jsonb_build_object('state', 'removido', 'technician_id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_remove_my_technician_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_remove_my_technician_profile() TO authenticated;
COMMIT;

-- Homologacao ANTES de qualquer release: executar com identidades sinteticas
-- independentes e RLS habilitada; testar criar, editar, reler, excluir, reler,
-- republicar; rejeitar anon, outro uid, bloqueado, suspenso/rejeitado; confirmar
-- que historicos, Pioneiros, contas e contatos de terceiros nao foram tocados.
