-- EUT / PR em preparação: instalação LOCAL ou aplicação futura separadamente autorizada.
-- NÃO aplicar automaticamente ao Supabase oficial. Uma única flag não crítica.
-- Estado inicial TRUE conserva a experiência pública atual.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('eut_migration.project_owner_bootstrap') IS NULL
    OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.eut_account_operational()') IS NULL
    OR to_regclass('auth.sessions') IS NULL
    OR to_regclass('eut_migration.admin_feature_flags') IS NOT NULL
    OR to_regclass('eut_migration.admin_feature_flag_audit') IS NOT NULL
    OR to_regprocedure('public.eut_home_public_proof_visible()') IS NOT NULL
    OR to_regprocedure('public.eut_admin_set_home_public_proof(boolean,boolean,text)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Preflight de configurações divergente; não instalar' USING ERRCODE='P0001';
  END IF;
END;
$preflight$;

CREATE TABLE eut_migration.admin_feature_flags (
  flag_key text PRIMARY KEY CHECK (flag_key='home_public_proof'),
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE eut_migration.admin_feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.admin_feature_flags FROM PUBLIC, anon, authenticated;
INSERT INTO eut_migration.admin_feature_flags(flag_key,enabled)
VALUES ('home_public_proof',true);

CREATE TABLE eut_migration.admin_feature_flag_audit (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flag_key text NOT NULL REFERENCES eut_migration.admin_feature_flags(flag_key),
  old_enabled boolean NOT NULL,
  new_enabled boolean NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  session_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 8 AND 240),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (old_enabled IS DISTINCT FROM new_enabled)
);
ALTER TABLE eut_migration.admin_feature_flag_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.admin_feature_flag_audit FROM PUBLIC, anon, authenticated;

-- A única informação pública é um booleano explícito. Nenhum dado privado
-- ou histórico de auditoria fica acessível pela Data API.
CREATE OR REPLACE FUNCTION public.eut_home_public_proof_visible()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
  SELECT coalesce((SELECT f.enabled FROM eut_migration.admin_feature_flags f
                   WHERE f.flag_key='home_public_proof'),true);
$function$;
REVOKE ALL ON FUNCTION public.eut_home_public_proof_visible()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_home_public_proof_visible() TO anon, authenticated;

-- Somente o usuário reivindicado no bootstrap privado do proprietário,
-- mantendo papel admin, e-mail atual confirmado, conta operacional e sessão
-- de Auth existente, pode alterar a flag. Um admin adicional não pode.
CREATE OR REPLACE FUNCTION public.eut_admin_set_home_public_proof(
  _enabled boolean, _expected_enabled boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_session uuid;
  v_current boolean;
  v_at timestamptz;
  v_reason text := btrim(coalesce(_reason,''));
BEGIN
  IF v_actor IS NULL OR coalesce(v_claims->>'sub','')<>v_actor::text
    OR coalesce(v_claims->>'session_id','') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT public.eut_account_operational()
    OR NOT EXISTS (
      SELECT 1 FROM eut_migration.project_owner_bootstrap b
      JOIN auth.users u ON u.id=b.claimed_user_id
      WHERE b.singleton=true AND b.claimed_user_id=v_actor
        AND lower(btrim(u.email))=b.owner_email
        AND u.email_confirmed_at IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'Proprietário autenticado exigido' USING ERRCODE='42501';
  END IF;
  v_session := (v_claims->>'session_id')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM auth.sessions s WHERE s.id=v_session AND s.user_id=v_actor
      AND (s.not_after IS NULL OR s.not_after>now())
  ) THEN
    RAISE EXCEPTION 'Sessão ativa exigida' USING ERRCODE='42501';
  END IF;
  IF _enabled IS NULL OR _expected_enabled IS NULL
    OR char_length(v_reason) NOT BETWEEN 8 AND 240 THEN
    RAISE EXCEPTION 'Estado e justificativa válidos são obrigatórios'
      USING ERRCODE='22023';
  END IF;

  SELECT f.enabled INTO v_current FROM eut_migration.admin_feature_flags f
  WHERE f.flag_key='home_public_proof' FOR UPDATE;
  IF NOT FOUND OR v_current IS DISTINCT FROM _expected_enabled THEN
    RAISE EXCEPTION 'Configuração alterada; recarregue' USING ERRCODE='40001';
  END IF;
  IF v_current IS NOT DISTINCT FROM _enabled THEN
    RAISE EXCEPTION 'Nenhuma alteração a registrar' USING ERRCODE='22023';
  END IF;

  v_at := clock_timestamp();
  UPDATE eut_migration.admin_feature_flags
    SET enabled=_enabled,updated_at=v_at,updated_by=v_actor
  WHERE flag_key='home_public_proof';
  INSERT INTO eut_migration.admin_feature_flag_audit
    (flag_key,old_enabled,new_enabled,actor_id,session_id,reason,changed_at)
  VALUES ('home_public_proof',v_current,_enabled,v_actor,v_session,v_reason,v_at);
  RETURN jsonb_build_object('ok',true,'enabled',_enabled,'changed_at',v_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.eut_admin_set_home_public_proof(boolean,boolean,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_set_home_public_proof(boolean,boolean,text)
  TO authenticated;

COMMIT;

-- Pós-checks locais/read-only após apply autorizado: RLS=true em ambas tabelas;
-- SELECT/UPDATE/DELETE por anon/authenticated=FALSE; RPC pública retorna true;
-- RPC de escrita anon=FALSE, autenticado=TRUE; conta não proprietária rejeitada;
-- audit recebe exatamente uma linha por mudança real e nunca por tentativa negada.
