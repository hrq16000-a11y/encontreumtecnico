-- PREPARAÇÃO DE PR: NÃO APLICAR AUTOMATICAMENTE AO SUPABASE OFICIAL.
-- Configurações comerciais privadas, governadas pelo proprietário EUT.
-- Não altera ainda a cotação RPC, limites do checkout, cobranças ou direitos.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('eut_migration.project_owner_bootstrap') IS NULL
    OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.eut_account_operational()') IS NULL
    OR to_regclass('auth.sessions') IS NULL
    OR to_regclass('eut_migration.mp_owner_settings') IS NOT NULL
    OR to_regclass('eut_migration.mp_owner_settings_audit') IS NOT NULL
    OR to_regprocedure('public.eut_admin_mp_settings()') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Preflight Mercado Pago divergente; não instalar' USING ERRCODE='P0001';
  END IF;
END;
$preflight$;

CREATE TABLE eut_migration.mp_owner_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  regular_price_cents integer NOT NULL DEFAULT 999 CHECK (regular_price_cents BETWEEN 100 AND 99900),
  outside_price_cents integer NOT NULL DEFAULT 2999 CHECK (outside_price_cents BETWEEN 100 AND 99900),
  regular_from time NOT NULL DEFAULT time '09:00',
  regular_until time NOT NULL DEFAULT time '18:00',
  daily_contact_limit smallint NOT NULL DEFAULT 2 CHECK (daily_contact_limit IN (1,2)),
  version bigint NOT NULL DEFAULT 1 CHECK (version>0),
  updated_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  CHECK (regular_from<regular_until)
);
ALTER TABLE eut_migration.mp_owner_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_migration.mp_owner_settings FROM PUBLIC, anon, authenticated;
INSERT INTO eut_migration.mp_owner_settings(singleton) VALUES(true);

CREATE TABLE eut_migration.mp_owner_settings_audit (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  session_id uuid NOT NULL,
  previous_settings jsonb NOT NULL,
  new_settings jsonb NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 8 AND 240),
  changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (previous_settings IS DISTINCT FROM new_settings)
);
ALTER TABLE eut_migration.mp_owner_settings_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_migration.mp_owner_settings_audit FROM PUBLIC, anon, authenticated;

-- Centralize the real owner/session check so no second admin can control pricing.
CREATE FUNCTION eut_migration.mp_is_current_owner()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_session uuid;
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
    ) THEN RETURN false;
  END IF;
  v_session := (v_claims->>'session_id')::uuid;
  RETURN EXISTS (
    SELECT 1 FROM auth.sessions s WHERE s.id=v_session AND s.user_id=v_actor
      AND (s.not_after IS NULL OR s.not_after>now())
  );
END;
$fn$;
REVOKE ALL ON FUNCTION eut_migration.mp_is_current_owner() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.eut_admin_mp_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $fn$
DECLARE v_row eut_migration.mp_owner_settings%ROWTYPE;
BEGIN
  IF NOT eut_migration.mp_is_current_owner() THEN
    RAISE EXCEPTION 'Proprietário autenticado exigido' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_row FROM eut_migration.mp_owner_settings WHERE singleton=true;
  RETURN jsonb_build_object(
    'enabled',v_row.enabled,'regular_price_cents',v_row.regular_price_cents,
    'outside_price_cents',v_row.outside_price_cents,
    'regular_from',to_char(v_row.regular_from,'HH24:MI'),
    'regular_until',to_char(v_row.regular_until,'HH24:MI'),
    'daily_contact_limit',v_row.daily_contact_limit,'version',v_row.version,
    'updated_at',v_row.updated_at
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_admin_mp_settings() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_mp_settings() TO authenticated;

CREATE FUNCTION public.eut_admin_mp_update_settings(
  _enabled boolean,_regular_price_cents integer,_outside_price_cents integer,
  _regular_from text,_regular_until text,_daily_contact_limit smallint,
  _expected_version bigint,_reason text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $fn$
DECLARE
  v_old eut_migration.mp_owner_settings%ROWTYPE;
  v_new eut_migration.mp_owner_settings%ROWTYPE;
  v_actor uuid := auth.uid();
  v_session uuid;
  v_reason text := btrim(coalesce(_reason,''));
  v_changed timestamptz := clock_timestamp();
BEGIN
  IF NOT eut_migration.mp_is_current_owner() THEN
    RAISE EXCEPTION 'Proprietário autenticado exigido' USING ERRCODE='42501';
  END IF;
  v_session := (auth.jwt()->>'session_id')::uuid;
  IF _enabled IS NULL OR _regular_price_cents IS NULL OR _outside_price_cents IS NULL
    OR _regular_price_cents NOT BETWEEN 100 AND 99900
    OR _outside_price_cents NOT BETWEEN 100 AND 99900
    OR _regular_from IS NULL OR _regular_from !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR _regular_until IS NULL OR _regular_until !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR _regular_from>=_regular_until OR _daily_contact_limit IS NULL
    OR _daily_contact_limit NOT IN (1,2)
    OR _expected_version IS NULL OR char_length(v_reason) NOT BETWEEN 8 AND 240 THEN
    RAISE EXCEPTION 'Configuração e justificativa inválidas' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_old FROM eut_migration.mp_owner_settings WHERE singleton=true FOR UPDATE;
  IF v_old.version<>_expected_version THEN
    RAISE EXCEPTION 'Configuração alterada; recarregue' USING ERRCODE='P0001';
  END IF;
  IF (v_old.enabled,v_old.regular_price_cents,v_old.outside_price_cents,
      v_old.regular_from,v_old.regular_until,v_old.daily_contact_limit)
     IS NOT DISTINCT FROM
     (_enabled,_regular_price_cents,_outside_price_cents,
      _regular_from::time,_regular_until::time,_daily_contact_limit) THEN
    RAISE EXCEPTION 'Nenhuma alteração a registrar' USING ERRCODE='22023';
  END IF;
  UPDATE eut_migration.mp_owner_settings SET enabled=_enabled,
    regular_price_cents=_regular_price_cents,outside_price_cents=_outside_price_cents,
    regular_from=_regular_from::time,regular_until=_regular_until::time,
    daily_contact_limit=_daily_contact_limit,version=version+1,
    updated_at=v_changed,updated_by=v_actor WHERE singleton=true RETURNING * INTO v_new;
  INSERT INTO eut_migration.mp_owner_settings_audit
    (actor_id,session_id,previous_settings,new_settings,reason,changed_at)
  VALUES (v_actor,v_session,to_jsonb(v_old)-'updated_by',to_jsonb(v_new)-'updated_by',
    v_reason,v_changed);
  RETURN jsonb_build_object('ok',true,'version',v_new.version);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_admin_mp_update_settings(boolean,integer,integer,text,text,smallint,bigint,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_mp_update_settings(boolean,integer,integer,text,text,smallint,bigint,text)
  TO authenticated;

COMMIT;

-- Before production: read-only preflight on official DB, isolated Postgres
-- tests with owner/non-owner sessions, RLS/grants, concurrent version update,
-- audit count, restore/rollback, then explicit authorization to apply SQL.
-- IMPORTANT: This file does not change the current purchase quote or checkout.
