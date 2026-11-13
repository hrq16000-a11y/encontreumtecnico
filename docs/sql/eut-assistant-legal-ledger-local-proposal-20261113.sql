-- Issue #261 — LOCAL-ONLY DESIGN PROPOSAL, NOT A DEPLOYABLE MIGRATION.
-- DO NOT execute against hosted Supabase, production, or the shared SQL editor.
-- This file is intentionally outside supabase/migrations.
-- Before any LOCAL execution, reconcile with the canonical schema and obtain
-- a separate approval for the disposable local database.
--
-- Purpose: append-only, per-user evidence for the assistant's CURRENT
-- legal terms and privacy versions. This does not reuse contact-sharing,
-- service-request acceptance or member-invitation records.

CREATE SCHEMA IF NOT EXISTS eut_assistant_legal;
REVOKE ALL ON SCHEMA eut_assistant_legal FROM PUBLIC;

CREATE TABLE eut_assistant_legal.acceptance_events (
  event_seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id uuid NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('accept', 'revoke')),
  terms_version text,
  privacy_notice_version text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idempotency_key uuid NOT NULL,
  CONSTRAINT eut_assistant_legal_event_idempotency UNIQUE (user_id, idempotency_key),
  CONSTRAINT eut_assistant_legal_event_versions CHECK (
    (
      event_kind = 'accept'
      AND terms_version IS NOT NULL
      AND length(btrim(terms_version)) BETWEEN 1 AND 120
      AND privacy_notice_version IS NOT NULL
      AND length(btrim(privacy_notice_version)) BETWEEN 1 AND 120
    )
    OR (
      event_kind = 'revoke'
      AND terms_version IS NULL
      AND privacy_notice_version IS NULL
    )
  )
);

CREATE INDEX eut_assistant_legal_events_user_order
  ON eut_assistant_legal.acceptance_events (user_id, event_seq);

ALTER TABLE eut_assistant_legal.acceptance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_assistant_legal.acceptance_events FORCE ROW LEVEL SECURITY;

-- No public/anonymous access, and no direct authenticated INSERT/UPDATE/DELETE.
-- Event writes and revocations need a future server-verified, audited,
-- idempotent transaction design. This proposal deliberately defines no writer.
REVOKE ALL ON eut_assistant_legal.acceptance_events
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA eut_assistant_legal TO authenticated;
GRANT SELECT ON eut_assistant_legal.acceptance_events TO authenticated;

-- Defense in depth: an authenticated SQL context can read only its own rows.
-- A future server handler must ALSO verify Auth session, account status, roles
-- and subject binding before invoking the reader (RLS alone is insufficient).
CREATE POLICY eut_assistant_legal_subject_read
  ON eut_assistant_legal.acceptance_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- PROPOSAL LIMITATIONS:
-- * No function, RPC, trigger, endpoint or writer is installed or executed.
-- * No Data API exposure of eut_assistant_legal is proposed.
-- * event_seq orders append events; server readers deny ambiguous/out-of-order
--   timestamps, missing evidence, cross-user rows, errors and revocation.
-- * Privileged DB roles can bypass ordinary grants/RLS; their use requires
--   separately reviewed server-side credentials and audit policy.
-- * Retention/deletion and legacy migration semantics remain undecided.
