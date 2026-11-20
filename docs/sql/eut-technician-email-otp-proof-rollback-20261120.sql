-- EUT / 2026-11-20 — ROLLBACK DE SEGURANÇA DA PROVA OTP (NÃO EXECUTAR AGORA).
-- Executar somente após aplicação autorizada do arquivo principal e decisão
-- explícita de rollback. Não apaga provas, desafios, contas nem contatos.
BEGIN;

-- Lease de rollback: verificar os corpos exatos instalados pela proposta
-- antes de revogar permissões, retirar o trigger ou restaurar o helper.
-- pg_proc.prosrc preserva o texto de AS $function$ do apply; se houve outra
-- versão, manutenção ou alteração posterior, ABORTAR sem modificar objetos.
DO $preflight$
BEGIN
  IF to_regprocedure('eut_migration.confirmed_current_email()') IS NULL
    OR to_regprocedure('eut_migration.revoke_technician_email_otp_on_email_change()') IS NULL
    OR to_regprocedure('public.eut_begin_technician_email_otp()') IS NULL
    OR to_regprocedure('public.eut_attest_technician_email_otp()') IS NULL
    OR to_regclass('eut_migration.technician_email_otp_proofs') IS NULL
    OR to_regclass('eut_migration.technician_email_otp_challenges') IS NULL
  THEN RAISE EXCEPTION 'Rollback abortado: objetos OTP ausentes ou divergentes' USING ERRCODE='P0001';
  END IF;

  IF (SELECT md5(p.prosrc) FROM pg_proc p
      WHERE p.oid=to_regprocedure('eut_migration.confirmed_current_email()'))
      IS DISTINCT FROM 'c74640a1357abcd8f7796edfc24910bb'
    OR (SELECT md5(p.prosrc) FROM pg_proc p
        WHERE p.oid=to_regprocedure('eut_migration.revoke_technician_email_otp_on_email_change()'))
      IS DISTINCT FROM 'e6bf7a52c456659d84b5155f12f04155'
    OR (SELECT md5(p.prosrc) FROM pg_proc p
        WHERE p.oid=to_regprocedure('public.eut_begin_technician_email_otp()'))
      IS DISTINCT FROM '20949942a868dfe748558a1dab7dce52'
    OR (SELECT md5(p.prosrc) FROM pg_proc p
        WHERE p.oid=to_regprocedure('public.eut_attest_technician_email_otp()'))
      IS DISTINCT FROM '55b94f57c240f44bd16862f022656cdb'
  THEN RAISE EXCEPTION 'Rollback abortado: função OTP mudou; revisar o diff antes de restaurar'
    USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid='auth.users'::regclass
      AND t.tgname='eut_revoke_technician_email_otp_on_email_change'
      AND t.tgfoid=to_regprocedure('eut_migration.revoke_technician_email_otp_on_email_change()')
      AND NOT t.tgisinternal
      AND t.tgenabled='O'
      AND lower(pg_get_triggerdef(t.oid)) LIKE '%after update of email on auth.users%'
      AND lower(pg_get_triggerdef(t.oid)) LIKE '%old.email is distinct from new.email%'
  ) THEN RAISE EXCEPTION 'Rollback abortado: trigger OTP mudou; revisar antes de remover'
    USING ERRCODE='P0001';
  END IF;
END;
$preflight$;

-- Cortar a revogação automática e as novas provas sem apagar auditoria.
DROP TRIGGER IF EXISTS eut_revoke_technician_email_otp_on_email_change ON auth.users;
REVOKE ALL ON FUNCTION eut_migration.revoke_technician_email_otp_on_email_change()
  FROM PUBLIC, anon, authenticated;

-- Cortar a emissão de novas provas e a confirmação, sem apagar auditoria.
REVOKE ALL ON FUNCTION public.eut_begin_technician_email_otp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eut_attest_technician_email_otp() FROM PUBLIC, anon, authenticated;

-- Definição exata da função oficial antes da PR #343; hash MD5 de
-- pg_get_functiondef na origem: bf0789e2b311454a6320ecdc5269e73f.
-- Restaura os dois critérios originais (Google verificado ou confirmação enviada).
CREATE OR REPLACE FUNCTION eut_migration.confirmed_current_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select lower(btrim(u.email))
  from auth.users u
  where u.id = auth.uid()
    and u.email is not null
    and u.email_confirmed_at is not null
    and (
      exists (
        select 1 from auth.identities i
        where i.user_id=u.id
          and i.provider='google'
          and lower(coalesce(i.identity_data->>'email',''))=lower(btrim(u.email))
          and coalesce(i.identity_data->>'email_verified','true') <> 'false'
      )
      or (
        -- A password signup must have been sent a confirmation email;
        -- this deliberately rejects accounts silently auto-confirmed.
        u.confirmation_sent_at is not null
        and u.email_confirmed_at >= u.confirmation_sent_at
        and exists (
          select 1 from auth.identities i
          where i.user_id=u.id
            and i.provider='email'
            and lower(coalesce(i.identity_data->>'email',''))=lower(btrim(u.email))
        )
      )
    )
  limit 1;
$function$;
COMMIT;

-- PÓS-CHECKS READ-ONLY:
-- SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc p
-- JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='eut_migration' AND p.proname='confirmed_current_email';
-- Esperado: bf0789e2b311454a6320ecdc5269e73f.
-- EXECUTE das duas RPCs novas deve ser FALSE para anon e authenticated.
-- RLS da tabela de provas permanece ativo; nenhuma evidência é excluída.
-- Se frontend já publicado, restaurar separadamente o deployment Vercel
-- anterior aprovado. Nunca executar DROP TABLE nem editar auth.users no rollback.
