-- EUT FASE 3 — CONTRACT-ONLY. DO NOT APPLY TO PRODUCTION IN THIS PR.
-- Public website and Supabase DB must not be independently enabled before privacy review,
-- verified server-only secrets, migration proof, role tests and scheduled retention.
-- New private objects only; does not alter existing contacts, roles, prices or RLS.
-- Access law: 6 calendar months for access records IF art. 15 applies.
-- Security: 90 days baseline subject to documented legal hold, not automatic 6 months.
-- Optional analytics + voluntary visit/account conversion: 30 days, never IP-based.
-- Authenticated legal receipts: separate retention for contractual/legal evidence.

CREATE TABLE IF NOT EXISTS eut_moderation.eut_visit_access_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_ip inet NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  legal_hold_until timestamptz NULL
);
CREATE INDEX IF NOT EXISTS eut_visit_access_records_at_idx
  ON eut_moderation.eut_visit_access_records (accessed_at);
ALTER TABLE eut_moderation.eut_visit_access_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_visit_access_records FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.eut_visitor_security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('auth_failure','request_rejected','contact_limit')),
  outcome text NOT NULL CHECK(outcome IN ('blocked','rejected')),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  legal_hold_until timestamptz NULL
);
CREATE INDEX IF NOT EXISTS eut_visitor_security_events_at_idx
  ON eut_moderation.eut_visitor_security_events(observed_at);
ALTER TABLE eut_moderation.eut_visitor_security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_visitor_security_events FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.eut_visitor_optin_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_token uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('consent_granted','consent_revoked',
    'view_home','view_directory','view_services','view_guides')),
  consent_version text NOT NULL CHECK (consent_version = '2026-11-22.1'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS eut_visitor_optin_events_token_time_idx
  ON eut_moderation.eut_visitor_optin_events(visitor_token, recorded_at DESC);
CREATE INDEX IF NOT EXISTS eut_visitor_optin_events_expiry_idx
  ON eut_moderation.eut_visitor_optin_events(recorded_at);
ALTER TABLE eut_moderation.eut_visitor_optin_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_visitor_optin_events FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.eut_visitor_account_conversions (
  visitor_token uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text NOT NULL CHECK(consent_version='2026-11-22.1'),
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS eut_visitor_account_conversions_account_idx
  ON eut_moderation.eut_visitor_account_conversions(account_id);
ALTER TABLE eut_moderation.eut_visitor_account_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_visitor_account_conversions FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.eut_account_legal_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT eut_account_legal_unique_version UNIQUE(account_id, terms_version, privacy_version)
);
CREATE INDEX IF NOT EXISTS eut_account_legal_receipts_account_idx
  ON eut_moderation.eut_account_legal_receipts(account_id, accepted_at DESC);
ALTER TABLE eut_moderation.eut_account_legal_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_account_legal_receipts FROM PUBLIC, anon, authenticated;

-- A: service-only ingress, never accept an IP, exact path, UTM, fingerprint or actor
-- from an anonymous browser RPC. A trusted Vercel backend decides which IP is origin.
CREATE OR REPLACE FUNCTION public.eut_visitor_access_ingest(_origin_ip text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
  THEN RAISE EXCEPTION 'service role only' USING ERRCODE='42501'; END IF;
  IF _origin_ip IS NULL OR char_length(_origin_ip) > 45
  THEN RAISE EXCEPTION 'invalid origin IP' USING ERRCODE='22023'; END IF;
  INSERT INTO eut_moderation.eut_visit_access_records(source_ip) VALUES (_origin_ip::inet);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_visitor_access_ingest(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_visitor_access_ingest(text) TO service_role;

-- B: server-verified security outcome only. No browser-supplied user identifiers.
CREATE OR REPLACE FUNCTION public.eut_visitor_security_ingest(_kind text, _outcome text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
  THEN RAISE EXCEPTION 'service role only' USING ERRCODE='42501'; END IF;
  IF _kind NOT IN ('auth_failure','request_rejected','contact_limit') OR
    _outcome NOT IN ('blocked','rejected')
  THEN RAISE EXCEPTION 'invalid event' USING ERRCODE='22023'; END IF;
  INSERT INTO eut_moderation.eut_visitor_security_events(kind,outcome) VALUES (_kind,_outcome);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_visitor_security_ingest(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_visitor_security_ingest(text,text) TO service_role;

-- C: visitors can voluntarily send an untrusted analytics signal only.
-- Such a signal is NOT a verifiable identity or legal acceptance receipt.
-- Rate caps are per anonymous random token; WAF/edge rate limits are still required.
CREATE OR REPLACE FUNCTION public.eut_visitor_optin_event(
  _visitor_token uuid, _event_kind text, _consent_version text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE v_recent integer; v_previous text;
BEGIN
  IF _visitor_token IS NULL OR _consent_version IS DISTINCT FROM '2026-11-22.1'
    OR _event_kind NOT IN ('consent_granted','consent_revoked','view_home',
      'view_directory','view_services','view_guides')
  THEN RETURN jsonb_build_object('ok',false); END IF;

  SELECT COUNT(*) INTO v_recent FROM eut_moderation.eut_visitor_optin_events
   WHERE visitor_token=_visitor_token AND recorded_at > clock_timestamp()-interval '1 hour';
  IF v_recent >= 20 THEN RETURN jsonb_build_object('ok',false); END IF;

  SELECT kind INTO v_previous FROM eut_moderation.eut_visitor_optin_events
   WHERE visitor_token=_visitor_token ORDER BY recorded_at DESC,id DESC LIMIT 1;
  IF _event_kind LIKE 'view_%' AND v_previous IS DISTINCT FROM 'consent_granted'
    AND NOT EXISTS(
      SELECT 1 FROM eut_moderation.eut_visitor_optin_events
      WHERE visitor_token=_visitor_token AND kind='consent_granted'
        AND recorded_at >= clock_timestamp()-interval '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM eut_moderation.eut_visitor_optin_events revoke
          WHERE revoke.visitor_token=_visitor_token AND revoke.kind='consent_revoked'
            AND revoke.recorded_at > eut_visitor_optin_events.recorded_at
        )
    )
  THEN RETURN jsonb_build_object('ok',false); END IF;
  INSERT INTO eut_moderation.eut_visitor_optin_events(visitor_token,kind,consent_version)
  VALUES(_visitor_token,_event_kind,_consent_version);
  RETURN jsonb_build_object('ok',true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_visitor_optin_event(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_visitor_optin_event(uuid,text,text) TO anon, authenticated;

-- Separate contractual receipt. Browser cannot set account ID or timestamp.
CREATE OR REPLACE FUNCTION public.eut_accept_legal_versions(_terms_version text,_privacy_version text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE v_actor uuid := auth.uid(); v_accepted timestamptz;
BEGIN
  IF v_actor IS NULL OR current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'authenticated'
  THEN RAISE EXCEPTION 'authenticated account required' USING ERRCODE='42501'; END IF;
  IF _terms_version IS DISTINCT FROM '2026-11-22' OR
     _privacy_version IS DISTINCT FROM '2026-11-22'
  THEN RETURN jsonb_build_object('ok',false); END IF;
  INSERT INTO eut_moderation.eut_account_legal_receipts(account_id,terms_version,privacy_version)
  VALUES(v_actor,_terms_version,_privacy_version)
  ON CONFLICT(account_id,terms_version,privacy_version) DO NOTHING;
  SELECT accepted_at INTO v_accepted FROM eut_moderation.eut_account_legal_receipts
  WHERE account_id=v_actor AND terms_version=_terms_version AND privacy_version=_privacy_version;
  RETURN jsonb_build_object('ok',true,'terms_version',_terms_version,
    'privacy_version',_privacy_version,'accepted_at',v_accepted);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_accept_legal_versions(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_accept_legal_versions(text,text) TO authenticated;

-- Explicit user click only, never automatic identity join, no guessing from IP/cookies.
CREATE OR REPLACE FUNCTION public.eut_link_my_optin_visit(_visitor_token uuid,_consent_version text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE v_actor uuid := auth.uid(); v_owner uuid;
BEGIN
  IF v_actor IS NULL OR current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'authenticated'
    OR _visitor_token IS NULL OR _consent_version IS DISTINCT FROM '2026-11-22.1'
  THEN RETURN jsonb_build_object('ok',false); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM eut_moderation.eut_visitor_optin_events
    WHERE visitor_token=_visitor_token AND kind='consent_granted'
      AND recorded_at >= clock_timestamp()-interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM eut_moderation.eut_visitor_optin_events r
        WHERE r.visitor_token=_visitor_token AND r.kind='consent_revoked'
          AND r.recorded_at > eut_visitor_optin_events.recorded_at
      )
  ) THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT account_id INTO v_owner FROM eut_moderation.eut_visitor_account_conversions
    WHERE visitor_token=_visitor_token;
  IF v_owner IS NOT NULL AND v_owner <> v_actor THEN RETURN jsonb_build_object('ok',false); END IF;
  INSERT INTO eut_moderation.eut_visitor_account_conversions(visitor_token,account_id,consent_version)
  VALUES(_visitor_token,v_actor,_consent_version)
  ON CONFLICT (visitor_token) DO NOTHING;
  RETURN jsonb_build_object('ok',true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_link_my_optin_visit(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_link_my_optin_visit(uuid,text) TO authenticated;

-- Purge is service-role/DB-owner only; never callable by public visitors.
-- Schedule separately after migration verification. If no scheduler exists, NOT automatic.
CREATE OR REPLACE FUNCTION public.eut_visitor_retention_purge(_max_per_table integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE v_a int; v_b int; v_c int; v_conv int; v_now timestamptz := clock_timestamp();
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
    AND session_user <> 'postgres'
  THEN RAISE EXCEPTION 'service role only' USING ERRCODE='42501'; END IF;
  IF _max_per_table < 1 OR _max_per_table > 5000
  THEN RAISE EXCEPTION 'invalid batch' USING ERRCODE='22023'; END IF;
  DELETE FROM eut_moderation.eut_visit_access_records WHERE id IN (
    SELECT id FROM eut_moderation.eut_visit_access_records
      WHERE accessed_at < v_now - INTERVAL '6 months'
        AND (legal_hold_until IS NULL OR legal_hold_until < v_now)
      ORDER BY accessed_at LIMIT _max_per_table
  );
  GET DIAGNOSTICS v_a = ROW_COUNT;
  DELETE FROM eut_moderation.eut_visitor_security_events WHERE id IN (
    SELECT id FROM eut_moderation.eut_visitor_security_events
    WHERE observed_at < v_now-INTERVAL '90 days'
      AND (legal_hold_until IS NULL OR legal_hold_until < v_now)
    ORDER BY observed_at LIMIT _max_per_table
  );
  GET DIAGNOSTICS v_b = ROW_COUNT;
  DELETE FROM eut_moderation.eut_visitor_optin_events WHERE id IN (
    SELECT id FROM eut_moderation.eut_visitor_optin_events
    WHERE recorded_at < v_now-INTERVAL '30 days'
    ORDER BY recorded_at LIMIT _max_per_table
  );
  GET DIAGNOSTICS v_c = ROW_COUNT;
  DELETE FROM eut_moderation.eut_visitor_account_conversions WHERE visitor_token IN (
    SELECT visitor_token FROM eut_moderation.eut_visitor_account_conversions
    WHERE linked_at < v_now-INTERVAL '30 days'
    ORDER BY linked_at LIMIT _max_per_table
  );
  GET DIAGNOSTICS v_conv = ROW_COUNT;
  RETURN jsonb_build_object('access',v_a,'security',v_b,'analytics',v_c,'conversions',v_conv);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_visitor_retention_purge(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_visitor_retention_purge(integer) TO service_role;

-- Confirm post-install: SELECT pg_get_functiondef(...), pg_policies, grants, exposed schemas,
-- anon/authenticated 42501 denial for A/B/purge; authenticated-only legal/link;
-- anonymous C cannot read any private table, cannot link; verify budget/rate test.
-- DO NOT switch VITE_EUT_VISITOR_ANALYTICS_ENABLED, VITE_EUT_VISITOR_ACCESS_ENABLED,
-- VITE_EUT_LEGAL_RECEIPT_ENABLED or server EUT_VISITOR_* until verified.
