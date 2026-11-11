-- Homologação FUNCIONAL SIMULADA, somente para executar após as três DDLs
-- num ÚNICO BEGIN/ROLLBACK. NÃO executar isoladamente em produção.
-- Nenhum INSERT/UPDATE/DELETE, nenhuma conta/teste persistido.
DO $eut_functional$
DECLARE
  v_known_id uuid;
  v_owner_id uuid;
  v_session uuid;
  v_session_user uuid;
  v_random_id uuid := gen_random_uuid();
BEGIN
  -- Um UUID aleatório não é usuário de Auth.
  IF eut_moderation.subject_operational(v_random_id) THEN
    RAISE EXCEPTION 'FALHA: UUID inexistente foi considerado operacional';
  END IF;
  IF eut_moderation.subject_operational(NULL) THEN
    RAISE EXCEPTION 'FALHA: usuário nulo foi considerado operacional';
  END IF;

  -- A ausência de JWT nunca comprova uma sessão válida.
  IF public.eut_sensitive_session_active() THEN
    RAISE EXCEPTION 'FALHA: sessão sem JWT foi autorizada';
  END IF;
  IF eut_moderation.is_verified_invite_owner() THEN
    RAISE EXCEPTION 'FALHA: visitante anônimo identificado como proprietário';
  END IF;
  IF public.eut_my_admin_invitation() <> '{}'::jsonb THEN
    RAISE EXCEPTION 'FALHA: convite exposto ao visitante';
  END IF;

  -- Conta de técnico existente, apenas identificada internamente nesta transação.
  SELECT u.id INTO v_known_id
  FROM auth.users u JOIN public.user_roles r ON r.user_id=u.id
  WHERE r.role='tecnico'::public.app_role
  ORDER BY u.created_at LIMIT 1;

  IF v_known_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub',v_known_id::text,'role','authenticated')::text,true);
    PERFORM set_config('request.jwt.claim.sub',v_known_id::text,true);
    IF auth.uid() IS DISTINCT FROM v_known_id THEN
      RAISE EXCEPTION 'FALHA: JWT de teste não foi simulado';
    END IF;
    IF eut_moderation.is_verified_invite_owner() THEN
      RAISE EXCEPTION 'FALHA: técnico recebeu autorização de proprietário';
    END IF;
    IF public.eut_my_admin_invitation() <> '{}'::jsonb THEN
      RAISE EXCEPTION 'FALHA: técnico visualizou convite não emitido';
    END IF;
    BEGIN
      PERFORM public.eut_owner_admin_invite_action(
        'create','eut-functional@example.invalid',NULL,
        'Teste negativo: nenhuma criação deve ocorrer');
      RAISE EXCEPTION 'FALHA: técnico criou convite de proprietário';
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
  END IF;

  -- Sessoes existentes são consultadas APENAS para leitura; não revogar ou escrever.
  SELECT s.id,s.user_id INTO v_session,v_session_user
  FROM auth.sessions s
  WHERE eut_moderation.subject_operational(s.user_id)
  ORDER BY s.created_at DESC LIMIT 1;

  IF v_session IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub',v_session_user::text,
        'session_id',v_session::text,'role','authenticated')::text,true);
    PERFORM set_config('request.jwt.claim.sub',v_session_user::text,true);
    IF NOT public.eut_sensitive_session_active() THEN
      RAISE EXCEPTION 'FALHA: sessão existente não operacional';
    END IF;
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub',v_session_user::text,
        'session_id',v_random_id::text,'role','authenticated')::text,true);
    IF public.eut_sensitive_session_active() THEN
      RAISE EXCEPTION 'FALHA: sessão inexistente foi aceita';
    END IF;
  END IF;

  -- Verifica a identidade Google do proprietário real sem criar convites.
  SELECT u.id INTO v_owner_id
  FROM auth.users u JOIN public.user_roles r ON r.user_id=u.id
  JOIN eut_migration.project_owner_bootstrap b
    ON lower(btrim(b.owner_email))=lower(btrim(u.email))
  WHERE r.role='admin'::public.app_role AND u.email_confirmed_at IS NOT NULL
    AND (b.claimed_user_id IS NULL OR b.claimed_user_id=u.id)
    AND EXISTS (SELECT 1 FROM auth.identities i
       WHERE i.user_id=u.id AND i.provider='google'
         AND lower(coalesce(i.identity_data->>'email',''))=lower(u.email))
  LIMIT 1;
  IF v_owner_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      jsonb_build_object('sub',v_owner_id::text,'role','authenticated')::text,true);
    PERFORM set_config('request.jwt.claim.sub',v_owner_id::text,true);
    IF NOT eut_moderation.is_verified_invite_owner() THEN
      RAISE EXCEPTION 'FALHA: proprietário Google verificado não reconhecido';
    END IF;
    IF public.eut_my_admin_invitation() <> '{}'::jsonb THEN
      RAISE EXCEPTION 'FALHA: proprietário recebeu convite inexistente';
    END IF;
  END IF;
  PERFORM set_config('request.jwt.claims','{}',true);
  PERFORM set_config('request.jwt.claim.sub','',true);
END
$eut_functional$;
