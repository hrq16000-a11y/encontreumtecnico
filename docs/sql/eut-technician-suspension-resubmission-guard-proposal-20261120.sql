-- PREFLIGHT DE PROTEÇÃO, SOMENTE VERIFICAÇÃO. NÃO APLICAR COMO MIGRAÇÃO.
-- O Supabase oficial já impede o titular de alterar fichas suspensas OU rejeitadas.
-- Um ALTER POLICY antigo que verificava apenas "suspenso" enfraqueceria a proteção.
-- Revalidar novamente a policy efetiva antes de ativar o contrato operacional #368.
-- Este arquivo não contém DDL/DML e não altera produção; CI o executa só no fixture.

DO $preflight$
DECLARE
  v_owner pg_catalog.pg_policies%ROWTYPE;
  v_admin pg_catalog.pg_policies%ROWTYPE;
BEGIN
  SELECT * INTO v_owner FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='technicians'
    AND policyname='Owner edits back to pending' AND cmd='UPDATE';
  IF NOT FOUND OR v_owner.permissive <> 'PERMISSIVE'
    OR v_owner.roles::text <> '{authenticated}'
    OR v_owner.qual IS DISTINCT FROM
      '((auth.uid() = user_id) AND (status <> ALL (ARRAY[''suspenso''::approval_status, ''rejeitado''::approval_status])))'
    OR v_owner.with_check IS DISTINCT FROM
      '((auth.uid() = user_id) AND (status = ''pendente''::approval_status))'
  THEN
    RAISE EXCEPTION 'Policy do titular divergente ou enfraquecida: NAO INSTALAR o contrato operacional'
      USING ERRCODE='55000';
  END IF;

  SELECT * INTO v_admin FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='technicians'
    AND policyname='Admin moderates' AND cmd='UPDATE';
  IF NOT FOUND OR v_admin.permissive <> 'PERMISSIVE'
    OR v_admin.roles::text <> '{authenticated}'
    OR v_admin.qual IS DISTINCT FROM
      'has_role(auth.uid(), ''admin''::app_role)'
    OR v_admin.with_check IS DISTINCT FROM
      'has_role(auth.uid(), ''admin''::app_role)'
  THEN
    RAISE EXCEPTION 'Policy de moderacao admin divergente: revisao manual necessaria'
      USING ERRCODE='55000';
  END IF;

  IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename='technicians' AND cmd='UPDATE') <> 2 THEN
    RAISE EXCEPTION 'Outra policy UPDATE detectada: revisar possiveis permissoes aditivas'
      USING ERRCODE='55000';
  END IF;
END;
$preflight$;

-- Não executar ALTER POLICY para "corrigir" o que já está protegido.
-- O contrato de operações da #368 é separado e ainda depende de aprovação SQL.
