-- PROPOSAL ONLY. DO NOT APPLY without explicit authorization and official preflight.
-- Private, owner-only settings for approximate regional order and subtle card highlights.
-- No phone, address, technician record, RLS policy or suspension is modified.
BEGIN;

CREATE TABLE IF NOT EXISTS eut_migration.directory_display_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  settings jsonb NOT NULL DEFAULT '{"auto_region":true,"online_priority":true,"referral_priority":true,"pioneer_priority":true,"online_outline":true,"enriched_outline":true,"photo_outline":true,"referral_label":true}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS eut_migration.directory_display_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version integer NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  session_id uuid NOT NULL,
  before_settings jsonb NOT NULL,
  after_settings jsonb NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 8 AND 400),
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eut_migration.directory_display_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_migration.directory_display_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.directory_display_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE eut_migration.directory_display_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE eut_migration.directory_display_audit_id_seq FROM PUBLIC, anon, authenticated;

INSERT INTO eut_migration.directory_display_settings (singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

-- No browser-supplied actor, email, owner UUID or role is trusted.
CREATE OR REPLACE FUNCTION eut_migration.directory_display_is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $sql$
 SELECT auth.uid() IS NOT NULL
   AND coalesce(auth.jwt()->>'session_id','') ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   AND EXISTS (
     SELECT 1 FROM auth.sessions s
     WHERE s.user_id = auth.uid() AND s.id = (auth.jwt()->>'session_id')::uuid
   )
   AND public.has_role(auth.uid(), 'admin'::public.app_role)
   AND public.eut_account_operational()
   AND EXISTS (
     SELECT 1 FROM eut_migration.project_owner_bootstrap b
     JOIN auth.users u ON u.id = b.claimed_user_id
     WHERE b.singleton AND b.claimed_user_id = auth.uid()
       AND b.claimed_at IS NOT NULL AND u.email_confirmed_at IS NOT NULL
       AND lower(btrim(u.email)) = b.owner_email
   );
$sql$;
REVOKE ALL ON FUNCTION eut_migration.directory_display_is_owner() FROM PUBLIC, anon, authenticated;

-- Anonymous visitors may only read harmless display toggles, no owner or audit metadata.
CREATE OR REPLACE FUNCTION public.eut_public_directory_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $sql$
 SELECT settings FROM eut_migration.directory_display_settings WHERE singleton;
$sql$;
REVOKE ALL ON FUNCTION public.eut_public_directory_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_directory_settings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.eut_owner_directory_settings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $sql$
DECLARE v_record record;
BEGIN
 IF NOT eut_migration.directory_display_is_owner() THEN
   RAISE EXCEPTION 'Proprietário autenticado obrigatório' USING ERRCODE='42501';
 END IF;
 SELECT settings, version, updated_at INTO STRICT v_record
   FROM eut_migration.directory_display_settings WHERE singleton;
 RETURN jsonb_build_object('settings',v_record.settings,'version',v_record.version,
   'updated_at',v_record.updated_at,
   'audit',(SELECT coalesce(jsonb_agg(jsonb_build_object('version',a.version,
     'reason',a.reason,'changed_at',a.changed_at) ORDER BY a.version DESC),'[]'::jsonb)
     FROM (SELECT version, reason, changed_at
       FROM eut_migration.directory_display_audit ORDER BY version DESC LIMIT 10) a));
END;
$sql$;
REVOKE ALL ON FUNCTION public.eut_owner_directory_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_owner_directory_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.eut_owner_update_directory_settings(
  _settings jsonb, _expected_version integer, _reason text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $sql$
DECLARE
 v_current eut_migration.directory_display_settings%ROWTYPE;
 v_key text;
 v_actor uuid := auth.uid();
 v_reason text := btrim(coalesce(_reason,''));
 v_expected_keys text[] := ARRAY['auto_region','online_priority','referral_priority',
   'pioneer_priority','online_outline','enriched_outline','photo_outline','referral_label'];
BEGIN
 IF NOT eut_migration.directory_display_is_owner() THEN
   RAISE EXCEPTION 'Proprietário autenticado obrigatório' USING ERRCODE='42501';
 END IF;
 IF length(v_reason) NOT BETWEEN 8 AND 400 OR v_reason ~* '(https?://|www[.]|@|[+]?[0-9][0-9 ()-]{8,}[0-9])' THEN
   RAISE EXCEPTION 'Justificativa inválida' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(_settings) IS DISTINCT FROM 'object'
   OR (SELECT count(*) FROM jsonb_object_keys(_settings)) <> array_length(v_expected_keys,1) THEN
   RAISE EXCEPTION 'Configuração inválida' USING ERRCODE='22023';
 END IF;
 FOREACH v_key IN ARRAY v_expected_keys LOOP
   IF jsonb_typeof(_settings->v_key) IS DISTINCT FROM 'boolean' THEN
     RAISE EXCEPTION 'Configuração inválida: %',v_key USING ERRCODE='22023';
   END IF;
 END LOOP;
 SELECT * INTO STRICT v_current FROM eut_migration.directory_display_settings
   WHERE singleton FOR UPDATE;
 IF v_current.version <> _expected_version THEN
   RAISE EXCEPTION 'Configuração desatualizada' USING ERRCODE='40001';
 END IF;
 IF v_current.settings = _settings THEN
   RETURN jsonb_build_object('settings',v_current.settings,'version',v_current.version);
 END IF;
 UPDATE eut_migration.directory_display_settings
   SET settings=_settings,version=version+1,updated_at=now(),updated_by=v_actor
   WHERE singleton;
 INSERT INTO eut_migration.directory_display_audit
   (version,actor_id,session_id,before_settings,after_settings,reason)
   VALUES (v_current.version+1,v_actor,(auth.jwt()->>'session_id')::uuid,
     v_current.settings,_settings,v_reason);
 RETURN jsonb_build_object('settings',_settings,'version',v_current.version+1);
END;
$sql$;
REVOKE ALL ON FUNCTION public.eut_owner_update_directory_settings(jsonb,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_owner_update_directory_settings(jsonb,integer,text) TO authenticated;

COMMIT;
