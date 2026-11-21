-- ALREADY APPLIED to Supabase project pqtzhctvjbfcunmrvxne on 2026-11-21.
-- Documentary copy of migration eut_imported_users_registry_by_owner_20261121.
-- Do NOT reapply blindly. No Auth user is fabricated; no public table access.
CREATE TABLE IF NOT EXISTS eut_moderation.imported_user_registry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id text NOT NULL UNIQUE,
 phone_e164 text NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+55[1-9]{2}[2-9][0-9]{7,8}$'),
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 3 AND 120),
 role text NOT NULL CHECK (role IN ('tecnico','cliente')),
 role_basis text NOT NULL,
 ddd text NOT NULL CHECK (ddd ~ '^[1-9][0-9]$'),
 region_approx text NOT NULL,
 declared_uf text NULL CHECK (declared_uf IS NULL OR declared_uf ~ '^[A-Z]{2}$'),
 import_sources text[] NOT NULL DEFAULT '{}',
 admin_active boolean NOT NULL DEFAULT true,
 blocked_on_import boolean NOT NULL DEFAULT false,
 technician_record_id uuid NULL REFERENCES eut_moderation.admin_technician_records(id) ON DELETE RESTRICT,
 linked_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
 audit_reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT registry_ddd_matches_phone CHECK (ddd=substring(phone_e164 from 4 for 2)),
 CONSTRAINT registry_blocked_not_active CHECK (NOT blocked_on_import OR NOT admin_active)
);
ALTER TABLE eut_moderation.imported_user_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.imported_user_registry FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS imported_user_registry_role_ddd_idx ON eut_moderation.imported_user_registry (role,ddd) WHERE admin_active;
COMMENT ON TABLE eut_moderation.imported_user_registry IS 'Owner-authorized unified administrative users before Auth claim; no anonymous access. No approval workflow.';
