-- EUT FASE 4 / PROPOSTA. DO NOT APPLY: no SQL, migration or deploy authorised.
-- ALL new objects. Does not change existing RPCs, roles, RLS, phone bans, pricing or data.
-- Action guard is NOT active until placed in the SAME transaction of each official
-- SECURITY DEFINER RPC; never rely on browser-side checks or an optional preflight.
-- This is a future integration proposal; do not enable Phase 3 A/B/C on its existence.
-- Verified failure reports must come from trusted server results, not client headers.
--
-- Phase 4 deliberately excludes login/recovery brute force: Supabase Auth + verified
-- Vercel edge protection must cover those independently, without account/IP-based DoS.

CREATE TABLE IF NOT EXISTS eut_moderation.eut_abuse_action_state (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_kind text NOT NULL CHECK(action_kind IN (
    'contact_access','direct_request','role_activation','member_invite')),
  failures_15m integer NOT NULL DEFAULT 0 CHECK(failures_15m BETWEEN 0 AND 10000),
  window_15m_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  failures_7d integer NOT NULL DEFAULT 0 CHECK(failures_7d BETWEEN 0 AND 10000),
  window_7d_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  prior_holds_7d integer NOT NULL DEFAULT 0 CHECK(prior_holds_7d BETWEEN 0 AND 10000),
  blocked_until timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_id,action_kind)
);
CREATE INDEX IF NOT EXISTS eut_abuse_action_state_until_idx
 ON eut_moderation.eut_abuse_action_state(blocked_until,updated_at);
ALTER TABLE eut_moderation.eut_abuse_action_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_abuse_action_state FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.eut_abuse_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  action_kind text NOT NULL CHECK(action_kind IN (
    'contact_access','direct_request','role_activation','member_invite')),
  action text NOT NULL CHECK(action='release'),
  reason text NOT NULL CHECK(length(reason) BETWEEN 12 AND 240),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS eut_abuse_admin_audit_recent_idx
 ON eut_moderation.eut_abuse_admin_audit(created_at DESC,id DESC);
ALTER TABLE eut_moderation.eut_abuse_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.eut_abuse_admin_audit FROM PUBLIC,anon,authenticated;

-- Trusted outcome only. Security definer uses a fixed pg_catalog search_path,
-- and the function is not exposed to browser roles. The authenticated
-- account must be verified by the official protected operation, never a JS claim.
-- pg_advisory_xact_lock + row FOR UPDATE serialize concurrent failures
-- from multiple application instances for the SAME account/action pair.
CREATE OR REPLACE FUNCTION eut_moderation.eut_abuse_record_verified_failure(
  _subject_id uuid, _action_kind text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE
 v_now timestamptz := clock_timestamp();
 v_data eut_moderation.eut_abuse_action_state%ROWTYPE;
 v_burst int; v_week int; v_prior int; v_started_15 timestamptz;
 v_started_7 timestamptz; v_hold timestamptz;
 v_hours int := 0;
BEGIN
 IF _subject_id IS NULL OR _action_kind NOT IN
 ('contact_access','direct_request','role_activation','member_invite') THEN
   RETURN jsonb_build_object('allowed',false,'reason','invalid_operation');
 END IF;
 -- Only real accounts. Never key this record by source IP, VPN, browser or e-mail.
 IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=_subject_id) THEN
   RETURN jsonb_build_object('allowed',false,'reason','unknown_account');
 END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(_subject_id::text || ':' || _action_kind,0)
 );
 INSERT INTO eut_moderation.eut_abuse_action_state(actor_id,action_kind)
 VALUES (_subject_id,_action_kind)
 ON CONFLICT (actor_id,action_kind) DO NOTHING;

 SELECT * INTO v_data FROM eut_moderation.eut_abuse_action_state
 WHERE actor_id=_subject_id AND action_kind=_action_kind FOR UPDATE;
 IF v_data.blocked_until > v_now THEN
   RETURN jsonb_build_object('allowed',false,'reason','cooldown',
     'retry_after_seconds',ceil(extract(epoch FROM (v_data.blocked_until-v_now)))::integer);
 END IF;

 v_started_15:=CASE WHEN v_data.window_15m_started_at<=v_now-interval '15 minutes'
                    THEN v_now ELSE v_data.window_15m_started_at END;
 v_started_7:=CASE WHEN v_data.window_7d_started_at<=v_now-interval '7 days'
                    THEN v_now ELSE v_data.window_7d_started_at END;
 v_burst:=CASE WHEN v_started_15=v_now THEN 1 ELSE least(10000,v_data.failures_15m+1) END;
 v_week:=CASE WHEN v_started_7=v_now THEN 1 ELSE least(10000,v_data.failures_7d+1) END;
 v_prior:=CASE WHEN v_started_7=v_now THEN 0 ELSE v_data.prior_holds_7d END;

 -- 5 = warning; verified repetition at 10 = 2h; at >=13 = 5h,
 -- repeated prior confirmed holds = 24h. No account-wide permanent ban.
 IF v_burst>=5 AND v_week>=13 THEN
   v_hours:=CASE WHEN v_prior>=2 THEN 24 ELSE 5 END;
 ELSIF v_burst>=5 AND v_week>=10 THEN v_hours:=2; END IF;
 v_hold:=CASE WHEN v_hours>0 THEN v_now+make_interval(hours=>v_hours) ELSE NULL END;

 UPDATE eut_moderation.eut_abuse_action_state SET
   failures_15m=v_burst,window_15m_started_at=v_started_15,
   failures_7d=v_week,window_7d_started_at=v_started_7,
   prior_holds_7d=least(10000,v_prior+CASE WHEN v_hours>0 THEN 1 ELSE 0 END),
   blocked_until=v_hold,updated_at=v_now
 WHERE actor_id=_subject_id AND action_kind=_action_kind;

 RETURN jsonb_build_object('allowed',v_hours=0,
   'reason',CASE WHEN v_hours>0 THEN 'cooldown' WHEN v_burst>=5 THEN 'warning' ELSE 'allow' END,
   'retry_after_seconds',v_hours*3600);
END;
$fn$;
REVOKE ALL ON FUNCTION eut_moderation.eut_abuse_record_verified_failure(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION eut_moderation.eut_abuse_record_verified_failure(uuid,text) TO service_role;

-- Read-only internal guard: official RPCs owned by postgres may call it
-- within their own transaction. It must run BEFORE returning protected data.
-- A blocked result should be returned as a controlled status (not RAISE), or
-- a transaction rollback would erase any accompanying state changes.
CREATE OR REPLACE FUNCTION eut_moderation.eut_abuse_decision(
  _subject_id uuid, _action_kind text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE v_until timestamptz; v_now timestamptz:=clock_timestamp();
BEGIN
 IF _subject_id IS NULL OR _action_kind NOT IN
  ('contact_access','direct_request','role_activation','member_invite')
 THEN RETURN jsonb_build_object('allowed',false,'reason','unverified_account'); END IF;
 SELECT blocked_until INTO v_until FROM eut_moderation.eut_abuse_action_state
 WHERE actor_id=_subject_id AND action_kind=_action_kind;
 IF v_until>v_now THEN
   RETURN jsonb_build_object('allowed',false,'reason','cooldown',
     'retry_after_seconds',ceil(extract(epoch FROM (v_until-v_now)))::integer);
 END IF;
 RETURN jsonb_build_object('allowed',true,'reason','allow','retry_after_seconds',0);
END;
$fn$;
REVOKE ALL ON FUNCTION eut_moderation.eut_abuse_decision(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION eut_moderation.eut_abuse_decision(uuid,text) TO service_role;

-- Admin read access: confirmed identity + public.has_role(...,'admin'),
-- 20 per page. No phone, e-mail, login token, IP, or private contact values.
CREATE OR REPLACE FUNCTION public.eut_admin_abuse_snapshot(
 _page integer DEFAULT 0, _action text DEFAULT 'todos'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE
 v_admin uuid:=auth.uid();
 v_page int:=coalesce(_page,0);
 v_total int:=0; v_rows jsonb:='[]'::jsonb; v_audit jsonb:='[]'::jsonb;
BEGIN
 IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::public.app_role)
    OR NOT EXISTS(SELECT 1 FROM auth.users u
                  WHERE u.id=v_admin AND u.email_confirmed_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Admin confirmado obrigatório' USING ERRCODE='42501';
 END IF;
 IF v_page NOT BETWEEN 0 AND 10000 OR coalesce(_action,'') NOT IN
    ('todos','contact_access','direct_request','role_activation','member_invite')
 THEN RAISE EXCEPTION 'Filtro inválido' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_total FROM eut_moderation.eut_abuse_action_state s
 WHERE _action='todos' OR s.action_kind=_action;
 SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO v_rows
 FROM (
   SELECT actor_id,action_kind,failures_15m,failures_7d,blocked_until,updated_at
   FROM eut_moderation.eut_abuse_action_state
   WHERE _action='todos' OR action_kind=_action
   ORDER BY updated_at DESC,actor_id,action_kind
   LIMIT 20 OFFSET (v_page*20)
 ) t;
 SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) INTO v_audit
 FROM (
   SELECT action_kind,action,reason,created_at,
     '…'||right(target_user_id::text,8) AS actor_suffix
   FROM eut_moderation.eut_abuse_admin_audit
   ORDER BY created_at DESC,id DESC LIMIT 20
 ) a;
 RETURN jsonb_build_object('ok',true,'rows',v_rows,'audit',v_audit,
   'total',v_total,'page',v_page);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_admin_abuse_snapshot(integer,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_abuse_snapshot(integer,text)
 TO authenticated;

-- Admin release only the temporary cooldown; NEVER undo existing blocked
-- accounts, phone blocks, suspended technicians, private contacts, or prices.
-- Optimistic revision avoids a race with freshly observed failures.
CREATE OR REPLACE FUNCTION public.eut_admin_abuse_release(
  _target_user_id uuid, _action_kind text,
  _expected_updated_at timestamptz, _reason text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog
AS $fn$
DECLARE v_admin uuid:=auth.uid(); v_old eut_moderation.eut_abuse_action_state%ROWTYPE;
        v_new eut_moderation.eut_abuse_action_state%ROWTYPE;
        v_reason text:=btrim(coalesce(_reason,''));
BEGIN
 IF v_admin IS NULL OR NOT public.has_role(v_admin,'admin'::public.app_role)
    OR NOT EXISTS(SELECT 1 FROM auth.users u
                  WHERE u.id=v_admin AND u.email_confirmed_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Admin confirmado obrigatório' USING ERRCODE='42501';
 END IF;
 IF _target_user_id IS NULL OR _target_user_id=v_admin OR _action_kind NOT IN
    ('contact_access','direct_request','role_activation','member_invite')
    OR _expected_updated_at IS NULL OR char_length(v_reason) NOT BETWEEN 12 AND 240
 THEN RAISE EXCEPTION 'Revisão inválida' USING ERRCODE='22023'; END IF;

 -- Same account/action serialization as the verifier. Do not race a failure update.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(_target_user_id::text || ':' || _action_kind,0)
 );
 SELECT * INTO v_old FROM eut_moderation.eut_abuse_action_state
 WHERE actor_id=_target_user_id AND action_kind=_action_kind FOR UPDATE;
 IF NOT FOUND OR v_old.updated_at IS DISTINCT FROM _expected_updated_at THEN
   RAISE EXCEPTION 'Estado alterado; atualize antes de rever' USING ERRCODE='40001';
 END IF;
 UPDATE eut_moderation.eut_abuse_action_state SET
   failures_15m=0,window_15m_started_at=clock_timestamp(),
   failures_7d=0,window_7d_started_at=clock_timestamp(),
   prior_holds_7d=0,blocked_until=NULL,updated_at=clock_timestamp()
 WHERE actor_id=_target_user_id AND action_kind=_action_kind
 RETURNING * INTO v_new;
 INSERT INTO eut_moderation.eut_abuse_admin_audit
   (admin_id,target_user_id,action_kind,action,reason,before_state,after_state)
 VALUES(v_admin,_target_user_id,_action_kind,'release',v_reason,
   jsonb_build_object('failures_15m',v_old.failures_15m,
     'failures_7d',v_old.failures_7d,'blocked_until',v_old.blocked_until),
   jsonb_build_object('failures_15m',v_new.failures_15m,
     'failures_7d',v_new.failures_7d,'blocked_until',v_new.blocked_until));
 RETURN jsonb_build_object('ok',true,'action','release','updated_at',v_new.updated_at);
END;
$fn$;
REVOKE ALL ON FUNCTION public.eut_admin_abuse_release(uuid,text,timestamptz,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_abuse_release(uuid,text,timestamptz,text)
 TO authenticated;

-- PLANNED OFFICIAL RPC INTEGRATION (NOT EXECUTED HERE):
-- eut_admin_unified_contact(...) => check inside its transaction using its
-- verified authenticated actor, then return a rate_limited status before
-- any private contact disclosure. Preserve existing payment, suspension, role,
-- phone-ban and audit logic unchanged.
-- eut_share_direct_request(...) => guard verified auth actor in the same transaction.
-- choose_account_type / eut_publish_my_technician / eut_accept_member_invitation
-- => guard per matching action after pre-existing ownership and role checks.
-- The service backend must record VERIFIED failures in a DIFFERENT transaction,
-- because thrown SQL errors roll back all writes in that transaction.
-- Do NOT add frontend RPC preflight as a substitute for these server checks.
-- Supabase Auth login/password reset need platform limits & WAF, independently.
-- Caller-controlled outcome, IP, X-Forwarded-For, User-Agent, ISP or VPN MUST NOT
-- feed this trusted failure RPC. A raw IP is never an account identifier.
-- Integration and edge/negative tests must pass before any Phase 3 A/B/C flag.
