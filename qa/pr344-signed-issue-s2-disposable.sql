-- PR #344 — S2 ONLY. A disposable, unlinked Supabase localhost fixture.
-- NEVER execute in official EUT; NOT a migration, no production privileges.
BEGIN;

CREATE TABLE public.pr344_signed_issue_s2_fixture (
  tab_hash text PRIMARY KEY CHECK (tab_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  hard_expires_at timestamptz NOT NULL,
  purge_after timestamptz NOT NULL,
  CHECK (expires_at <= hard_expires_at),
  CHECK (purge_after >= hard_expires_at + interval '120 seconds')
);

ALTER TABLE public.pr344_signed_issue_s2_fixture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_signed_issue_s2_fixture FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.pr344_signed_issue_s2_fixture TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
