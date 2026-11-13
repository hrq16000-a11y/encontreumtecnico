-- PROPOSAL ONLY — do not execute on hosted Supabase or production.
-- Requires reviewed R1/R2, verified ORIGINAL WordPress backup and a separate
-- release/rollback decision. No data backfill or public API is authorized.
-- The archived alias is a source label, never verified legal identity.
BEGIN;

-- Private append-once extension of the EXISTING canonical technician registry.
-- No second public catalog and no changes to public.technicians or R2 RPC.
CREATE TABLE IF NOT EXISTS eut_moderation.catalog_wordpress_original_alias (
  technician_id uuid PRIMARY KEY
    REFERENCES eut_moderation.catalog_provenance(technician_id) ON DELETE RESTRICT,
  source_key text NOT NULL UNIQUE,
  original_alias text NOT NULL
    CHECK (char_length(original_alias) BETWEEN 1 AND 160
       AND original_alias !~ '[[:cntrl:]]'),
  original_alias_sha256 text NOT NULL
    CHECK (original_alias_sha256 ~ '^[0-9a-f]{64}$'),
  backup_sha256 text NOT NULL
    CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eut_wp_original_source_id CHECK (
    source_key ~ '^wordpress_20261108:[1-9][0-9]*$'
  )
);

CREATE OR REPLACE FUNCTION eut_moderation.guard_catalog_wordpress_original_alias()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'pg_catalog' AS $guard$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'WordPress original alias is append-only'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM eut_moderation.catalog_provenance p
    WHERE p.technician_id = NEW.technician_id
      AND p.catalog_origin = 'wordpress'
      AND p.source_key = NEW.source_key
  ) THEN
    RAISE EXCEPTION 'WordPress alias requires exact private R1 provenance'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS eut_wp_original_alias_write_once
  ON eut_moderation.catalog_wordpress_original_alias;
CREATE TRIGGER eut_wp_original_alias_write_once
  BEFORE INSERT OR UPDATE OR DELETE
  ON eut_moderation.catalog_wordpress_original_alias
  FOR EACH ROW EXECUTE FUNCTION
    eut_moderation.guard_catalog_wordpress_original_alias();

ALTER TABLE eut_moderation.catalog_wordpress_original_alias
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_moderation.catalog_wordpress_original_alias
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eut_moderation.guard_catalog_wordpress_original_alias()
  FROM PUBLIC, anon, authenticated;
COMMIT;

-- RELEASE BLOCKERS (separate approval required):
-- 1. The exact raw title must be independently attested from the original
--    WordPress backup (SHA-256 pinned outside Git). A self-made hash does not
--    attest the source, and the editable review mirror is insufficient.
-- 2. Only a reviewed privileged PRIVATE importer may INSERT, once, after
--    checking the original-alias digest, R1 source_key, technician_id and
--    distinct source backup. Never use public/admin CRUD to edit this table.
-- 3. Verify RLS/owner permissions, idempotency, concurrent inserts, source-key
--    changes and rollback using disposable LOCAL PostgreSQL before any release.
--    A mismatch after later R1 edits MUST fail closed at projection time.
-- 4. R2 eligibility remains mandatory and precedes any public projection.
--    Do not serialize this table, hashes, private IDs, audit or contacts.
--    Public listings call every eligible entry simply 'Técnico'.
-- 5. This file does not authorize running SQL, importing data or deployment.
