-- Issue #261 / ONLY OFFLINE PROPOSAL: appendOnce LOCAL transaction.
-- Not a migration. Never run in hosted Supabase, shared SQL editors, CI or production.
-- Execution requires separate, explicit authorization for a disposable LOCAL DB.
-- Depends on docs/sql/eut-assistant-legal-ledger-local-proposal-20261113.sql.
-- Matches LocalLegalAppendOnce in assistant-legal-ledger-local-writer-proposal.server.ts.
-- NO route, AI client, database credential, writer role or grants are activated.
--
-- Permission prerequisite (NOT performed by this proposal):
-- * A dedicated server-only, NOLOGIN/non-BYPASSRLS executor role, not anon or
--   authenticated, needs schema USAGE, table SELECT/INSERT, identity sequence
--   USAGE, FUNCTION EXECUTE and subject-bound SELECT/INSERT RLS policies.
-- * Its server connection must set verified auth.uid() claims from a checked
--   session, and independently enforce active account + allowed app role.
-- * NEVER grant direct INSERT or function EXECUTE to anon/authenticated.
-- * The table's FORCE RLS stays enabled. No privileged owner/service-role
--   bypass can substitute for the server's identity and authorization check.
--
-- Exact LOCAL-only proposal DDL, NOT EXECUTED:
BEGIN;

CREATE FUNCTION eut_assistant_legal.append_once_local(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_event_kind text,
  p_terms_version text,
  p_privacy_notice_version text
)
RETURNS TABLE (
  status text,
  event_seq text,
  event_id text,
  user_id text,
  idempotency_key text,
  event_kind text,
  terms_version text,
  privacy_notice_version text,
  recorded_at text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, eut_assistant_legal
AS $eut261_append_once$
DECLARE
  v_prior eut_assistant_legal.acceptance_events%ROWTYPE;
  v_latest eut_assistant_legal.acceptance_events%ROWTYPE;
  v_created eut_assistant_legal.acceptance_events%ROWTYPE;
  v_event_count integer;
  v_recorded_at timestamptz;
BEGIN
  -- Only a verified, session-bound server principal may write its own history.
  IF p_user_id IS NULL OR p_idempotency_key IS NULL
     OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'legal event subject not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_event_kind = 'accept' THEN
    IF p_terms_version IS NULL
       OR length(btrim(p_terms_version)) NOT BETWEEN 1 AND 120
       OR p_privacy_notice_version IS NULL
       OR length(btrim(p_privacy_notice_version)) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'invalid legal acceptance versions' USING ERRCODE = '22023';
    END IF;
  ELSIF p_event_kind = 'revoke' THEN
    IF p_terms_version IS NOT NULL OR p_privacy_notice_version IS NOT NULL THEN
      RAISE EXCEPTION 'revocation cannot carry versions' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid legal event kind' USING ERRCODE = '22023';
  END IF;

  -- Transaction-scoped serialization for one user, including concurrent keys.
  -- A hash collision only serializes unrelated users; it cannot mix their rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 261));

  -- Replay takes priority over current state and the bounded-history ceiling.
  SELECT e.* INTO v_prior
  FROM eut_assistant_legal.acceptance_events AS e
  WHERE e.user_id = p_user_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_prior.event_kind = p_event_kind
       AND v_prior.terms_version IS NOT DISTINCT FROM p_terms_version
       AND v_prior.privacy_notice_version IS NOT DISTINCT FROM p_privacy_notice_version THEN
      RETURN QUERY SELECT
        'replayed'::text, v_prior.event_seq::text, v_prior.event_id::text,
        v_prior.user_id::text, v_prior.idempotency_key::text,
        v_prior.event_kind, v_prior.terms_version, v_prior.privacy_notice_version,
        to_char(v_prior.recorded_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
    ELSE
      RETURN QUERY SELECT
        'idempotency_conflict'::text, NULL::text, NULL::text, NULL::text,
        NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    END IF;
    RETURN;
  END IF;

  SELECT e.* INTO v_latest
  FROM eut_assistant_legal.acceptance_events AS e
  WHERE e.user_id = p_user_id
  ORDER BY e.event_seq DESC LIMIT 1;

  IF p_event_kind = 'revoke'
     AND (v_latest.event_seq IS NULL OR v_latest.event_kind <> 'accept') THEN
    RETURN QUERY SELECT
      'no_active_acceptance'::text, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- The already-approved reader refuses histories with >512 entries.
  SELECT count(*)::integer INTO v_event_count
  FROM eut_assistant_legal.acceptance_events AS e
  WHERE e.user_id = p_user_id;
  IF v_event_count >= 512 THEN
    RAISE EXCEPTION 'legal event history limit reached' USING ERRCODE = '54000';
  END IF;

  IF v_latest.event_seq IS NOT NULL
     AND v_latest.recorded_at > clock_timestamp() + interval '60 seconds' THEN
    RAISE EXCEPTION 'inconsistent legal event clock' USING ERRCODE = '22000';
  END IF;

  v_recorded_at := clock_timestamp();
  IF v_latest.event_seq IS NOT NULL THEN
    -- Strictly increasing also after JS Date.parse truncates to milliseconds.
    v_recorded_at := greatest(
      v_recorded_at, v_latest.recorded_at + interval '1 millisecond'
    );
  END IF;

  INSERT INTO eut_assistant_legal.acceptance_events AS e (
    user_id, idempotency_key, event_kind,
    terms_version, privacy_notice_version, recorded_at
  ) VALUES (
    p_user_id, p_idempotency_key, p_event_kind,
    p_terms_version, p_privacy_notice_version, v_recorded_at
  ) RETURNING e.* INTO v_created;

  RETURN QUERY SELECT
    'appended'::text, v_created.event_seq::text, v_created.event_id::text,
    v_created.user_id::text, v_created.idempotency_key::text,
    v_created.event_kind, v_created.terms_version,
    v_created.privacy_notice_version,
    to_char(v_created.recorded_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
END;
$eut261_append_once$;

-- PostgreSQL otherwise gives PUBLIC EXECUTE on newly-created functions.
-- This function deliberately remains UNCALLABLE by public client roles.
REVOKE ALL ON FUNCTION eut_assistant_legal.append_once_local(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Planned future server-only prepared call, NOT EXECUTED:
-- SELECT * FROM eut_assistant_legal.append_once_local(
--   $1::uuid, $2::uuid, $3::text, $4::text, $5::text
-- );
-- $1 verified userId, $2 idempotencyKey, $3 accept|revoke,
-- $4 current canonical termsVersion or NULL, $5 privacyNoticeVersion or NULL.
-- Map returned snake_case audit fields to LocalLegalStoredAudit camelCase;
-- map SQL exceptions and unexpected rows to writer status 'unavailable'.
-- This one statement is atomic and locks this user's append stream until
-- the surrounding transaction ends. Do not combine with untrusted DML.
--
-- Pending permission design for a separately approved LOCAL disposable DB:
-- A dedicated NOLOGIN role (e.g. eut_legal_local_writer), allowed only through
-- a trusted backend connection, must have SQL grants and user-bound RLS:
--   GRANT USAGE ON SCHEMA eut_assistant_legal TO eut_legal_local_writer;
--   GRANT SELECT, INSERT ON eut_assistant_legal.acceptance_events
--     TO eut_legal_local_writer;
--   GRANT USAGE ON SEQUENCE eut_assistant_legal.acceptance_events_event_seq_seq
--     TO eut_legal_local_writer;
--   GRANT EXECUTE ON FUNCTION eut_assistant_legal.append_once_local(
--     uuid, uuid, text, text, text) TO eut_legal_local_writer;
--   CREATE POLICY eut_legal_local_writer_read
--     ON eut_assistant_legal.acceptance_events FOR SELECT
--     TO eut_legal_local_writer USING (auth.uid() = user_id);
--   CREATE POLICY eut_legal_local_writer_insert
--     ON eut_assistant_legal.acceptance_events FOR INSERT
--     TO eut_legal_local_writer WITH CHECK (auth.uid() = user_id);
-- These are COMMENTS, not active grants. The exact auth-claims setup, server
-- connection impersonation and role provisioning must be reviewed/authorized.
-- NO UPDATE/DELETE, no Data API exposure, no hosted credentials.
--
-- Local-only homologation plan (requires a NEW explicit authorization):
-- 1. Confirm branch, verify a free disposable PostgreSQL LOCAL runtime and
--    role model; use synthetic UUID subjects/keys and canonical policy versions.
-- 2. In isolated throwaway DB, apply existing proposal schema then the DDL
--    above plus only separately approved, minimal writer-role permissions.
-- 3. Test unauthenticated, expired/forbidden-app-role (server guard), spoofed
--    userId, cross-user SELECT/INSERT, anon/authenticated EXECUTE denials.
-- 4. Test accept, exact-key replay (same event_seq/event_id), conflicting-key
--    rejection, revoke without acceptance, accept/revoke/reaccept and older
--    version reaccept not authorizing the current assistant.
-- 5. Test concurrent accept/revoke for one user vs another: one write per key,
--    stable event_seq order, UTC microseconds and strictly growing JS ms.
-- 6. Test DB-error rollback, immutable history, malformed audit/read failure,
--    and a 513th write denied to protect the reader's 512-record bound.
-- 7. Each isolated single-connection scenario uses BEGIN/ROLLBACK; multi-
--    connection concurrency uses a dedicated disposable DB and discarded
--    local storage. Never DROP/ROLLBACK against shared or hosted resources.
-- 8. Publish sanitized results to Issue #261 ONLY after authorization; remove
--    local disposable resources, verify no migrations/routes/AI/deploy changed.
--
-- Known blockers: no approved local execution/permissions yet; not a live
-- implementation. A subsequent, separate activation/review round is needed.