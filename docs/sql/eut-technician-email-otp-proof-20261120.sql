-- EUT / 2026-11-20 — PREPARAÇÃO PARA REVISÃO, NÃO EXECUTAR SEM AUTORIZAÇÃO.
-- Aplica uma prova de titularidade de e-mail obtida por sessão OTP/magiclink legítima.
-- Não altera auth.users, papéis, fichas, RLS existente ou telefones privados.
-- Pré-condições: confirmar as definições atuais de confirmed_current_email(),
-- eut_account_operational(), auth.sessions e a configuração de redirects do Auth.
BEGIN;

-- Não expor pela Data API: eut_migration é esquema privado. Sem políticas de
-- acesso para anon/authenticated; somente esta RPC auditada escreve a prova.
CREATE TABLE eut_migration.technician_email_otp_proofs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_email text NOT NULL,
  verified_at timestamptz NOT NULL,
  proof_session_id uuid NOT NULL,
  proof_method text NOT NULL CHECK (proof_method IN ('otp', 'magiclink'))
);
ALTER TABLE eut_migration.technician_email_otp_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.technician_email_otp_proofs FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE eut_migration.technician_email_otp_proofs IS
  'Prova privada de e-mail por sessão OTP verificada pelo Supabase Auth; nenhum token ou telefone armazenado.';

-- Chamável somente pelo próprio técnico, com token assinado do Auth, sessão
-- existente e login OTP recente APÓS o envio do link de e-mail.
-- OTP de telefone não serve: exige ausência de telefone e identidade telefônica
-- no Auth, além de uma identidade email correspondente ao e-mail atual.
CREATE OR REPLACE FUNCTION public.eut_attest_technician_email_otp()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_session uuid;
  v_email text;
  v_sent_at timestamptz;
  v_method text;
  v_authenticated_at timestamptz;
BEGIN
  IF v_user IS NULL OR coalesce(v_claims->>'sub','') <> v_user::text
    OR coalesce(v_claims->>'session_id','') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    OR NOT public.has_role(v_user,'tecnico'::public.app_role)
    OR NOT public.eut_account_operational()
  THEN
    RAISE EXCEPTION 'Comprovação da sessão técnica exigida' USING ERRCODE='42501';
  END IF;
  v_session := (v_claims->>'session_id')::uuid;

  SELECT lower(btrim(u.email)),u.recovery_sent_at
    INTO v_email,v_sent_at
  FROM auth.users u
  WHERE u.id=v_user
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND nullif(btrim(coalesce(u.phone,'')),'') IS NULL
    AND EXISTS(
      SELECT 1 FROM auth.identities i
      WHERE i.user_id=u.id AND i.provider='email'
        AND lower(btrim(coalesce(i.identity_data->>'email','')))=lower(btrim(u.email))
    )
    AND NOT EXISTS(
      SELECT 1 FROM auth.identities i
      WHERE i.user_id=u.id AND i.provider='phone'
    );
  IF v_email IS NULL OR v_sent_at IS NULL THEN
    RAISE EXCEPTION 'A prova de e-mail não está disponível' USING ERRCODE='42501';
  END IF;

  -- O JWT é assinado pelo Supabase Auth. Nunca aceitar prova via user_metadata,
  -- parâmetros do cliente ou apenas email_confirmed_at autoconfirmado.
  SELECT amr.item->>'method',to_timestamp((amr.item->>'timestamp')::numeric)
    INTO v_method,v_authenticated_at
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_claims->'amr')='array'
      THEN v_claims->'amr' ELSE '[]'::jsonb END
  ) AS amr(item)
  WHERE amr.item->>'method' IN ('otp','magiclink')
    AND coalesce(amr.item->>'timestamp','') ~ '^[0-9]{9,11}$'
  ORDER BY (amr.item->>'timestamp')::numeric DESC
  LIMIT 1;

  IF v_authenticated_at IS NULL
    OR v_authenticated_at NOT BETWEEN now()-interval '15 minutes'
                                   AND now()+interval '2 minutes'
    OR v_sent_at NOT BETWEEN v_authenticated_at-interval '2 hours'
                             AND v_authenticated_at+interval '2 minutes'
    OR NOT EXISTS(
      SELECT 1 FROM auth.sessions s
      WHERE s.id=v_session AND s.user_id=v_user
        AND (s.not_after IS NULL OR s.not_after>now())
        AND s.created_at BETWEEN v_authenticated_at-interval '3 minutes'
                             AND v_authenticated_at+interval '3 minutes'
    )
  THEN
    RAISE EXCEPTION 'É necessário entrar pelo link enviado ao e-mail' USING ERRCODE='42501';
  END IF;

  INSERT INTO eut_migration.technician_email_otp_proofs
    (user_id,verified_email,verified_at,proof_session_id,proof_method)
  VALUES(v_user,v_email,now(),v_session,v_method)
  ON CONFLICT (user_id) DO UPDATE
    SET verified_email=EXCLUDED.verified_email,
        verified_at=EXCLUDED.verified_at,
        proof_session_id=EXCLUDED.proof_session_id,
        proof_method=EXCLUDED.proof_method;

  RETURN jsonb_build_object('ok',true,'verified',true);
END;
$function$;
REVOKE ALL ON FUNCTION public.eut_attest_technician_email_otp() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_attest_technician_email_otp() TO authenticated;

-- Mantém integralmente as duas provas legadas (Google e confirmação de
-- cadastro por e-mail). Apenas a terceira alternativa usa atestação OTP.
-- A regra de papel técnico, o bloqueio de suspensos e a RPC de publicação não mudam.
CREATE OR REPLACE FUNCTION eut_migration.confirmed_current_email()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
  SELECT lower(btrim(u.email))
  FROM auth.users u
  WHERE u.id=auth.uid()
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND (
      EXISTS(
        SELECT 1 FROM auth.identities i
        WHERE i.user_id=u.id AND i.provider='google'
          AND lower(coalesce(i.identity_data->>'email',''))=lower(btrim(u.email))
          AND coalesce(i.identity_data->>'email_verified','true')<>'false'
      )
      OR (
        u.confirmation_sent_at IS NOT NULL
        AND u.email_confirmed_at >= u.confirmation_sent_at
        AND EXISTS(
          SELECT 1 FROM auth.identities i
          WHERE i.user_id=u.id AND i.provider='email'
            AND lower(coalesce(i.identity_data->>'email',''))=lower(btrim(u.email))
        )
      )
      OR (
        public.eut_account_operational()
        AND EXISTS(
          SELECT 1 FROM eut_migration.technician_email_otp_proofs p
          JOIN public.user_roles r ON r.user_id=p.user_id
            AND r.role='tecnico'::public.app_role
          WHERE p.user_id=u.id
            AND p.verified_email=lower(btrim(u.email))
            AND p.verified_at <= now()
        )
        AND EXISTS(
          SELECT 1 FROM auth.identities i
          WHERE i.user_id=u.id AND i.provider='email'
            AND lower(coalesce(i.identity_data->>'email',''))=lower(btrim(u.email))
        )
      )
    )
  LIMIT 1;
$function$;

COMMIT;

-- PÓS-CHECKS READ-ONLY OBRIGATÓRIOS APÓS AUTORIZAÇÃO E APPLY:
-- 1) SELECT relrowsecurity FROM pg_class WHERE oid='eut_migration.technician_email_otp_proofs'::regclass;
-- 2) SELECT has_function_privilege('anon','public.eut_attest_technician_email_otp()','EXECUTE'),
--           has_function_privilege('authenticated','public.eut_attest_technician_email_otp()','EXECUTE');
-- 3) Confirmar que a conta sem OTP segue recusada; OTP de e-mail válido
--    prova apenas a própria conta, e alteração de e-mail revoga a correspondência.
-- 4) Homologar com técnico autorizado e sem contatos suspensos, sem dados sintéticos na produção.
-- ROLLBACK: restaurar a definição anterior de confirmed_current_email()
-- (extraída de pg_get_functiondef ANTES do apply), então revogar/remover a RPC;
-- a tabela de provas privadas deve ser mantida para auditoria até revisão explícita.
