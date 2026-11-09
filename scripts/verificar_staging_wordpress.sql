-- Read-only check; never expose raw staging rows or PII in CI logs.
SELECT
  (SELECT count(*) FROM eut_migration.legacy_accounts) AS accounts,
  (SELECT count(*) FROM eut_migration.legacy_directory WHERE kind='candidate') AS candidates,
  (SELECT count(*) FROM eut_migration.legacy_directory WHERE kind='employer') AS employers,
  (SELECT count(*) FROM eut_migration.legacy_jobs) AS jobs,
  (SELECT count(*) FROM eut_migration.legacy_media) AS media,
  (SELECT count(*) FROM eut_migration.legacy_terms) AS terms,
  (SELECT count(*) FROM eut_migration.legacy_taxonomy) AS taxonomy,
  (SELECT count(*) FROM eut_migration.legacy_term_relationships) AS relationships,
  (SELECT count(*) FROM eut_migration.legacy_directory d
    LEFT JOIN eut_migration.legacy_accounts a
    ON a.source_key=d.source_key AND a.wp_user_id=d.wp_user_id
    WHERE a.wp_user_id IS NULL) AS orphaned_directory,
  (SELECT count(*) FROM eut_migration.legacy_directory WHERE review_status!='pending_review') AS prematurely_approved,
  (SELECT count(*) FROM eut_migration.legacy_accounts WHERE auth_user_id IS NOT NULL) AS legacy_claims,
  (SELECT count(*) FROM auth.users) AS active_auth_accounts,
  has_schema_privilege('anon','eut_migration','USAGE') AS anon_schema_access,
  has_schema_privilege('authenticated','eut_migration','USAGE') AS authenticated_schema_access;
-- Expected snapshot after first import:
-- 912,384,270,20,434,60,60,1162,0,0,0,0,false,false.
-- For new registrations, active_auth_accounts and legacy_claims will legitimately change.
