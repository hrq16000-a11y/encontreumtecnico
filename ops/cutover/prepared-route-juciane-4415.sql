-- PREPARED OPERATOR ACTION - DO NOT EXECUTE AUTOMATICALLY.
-- This is a data backfill plan, NOT a schema migration or production automation.
-- Execute only after GitHub gates, preview HTTP tests and backup validation;
-- user approval required for the single public historical row.
-- Source was already published on WordPress. Do not approve technician or expose contacts.
BEGIN;

DO $body$
DECLARE
  eligible_count integer;
  existing_count integer;
BEGIN
  SELECT count(*) INTO eligible_count
  FROM public.legacy_review_profiles
  WHERE kind = 'candidate'
    AND wp_post_id = 4415
    AND source_key = 'wordpress_20261108'
    AND slug = 'juciane-machado'
    AND source_status = 'publish'
    AND review_status = 'pending_review'
    AND demo_candidate IS FALSE;

  IF eligible_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one eligible historical candidate, found %', eligible_count;
  END IF;

  SELECT count(*) INTO existing_count
  FROM public.eut_legacy_url_routes
  WHERE (kind = 'candidate' AND slug = 'juciane-machado')
     OR (source_key = 'wordpress_20261108' AND wp_post_id = 4415);

  IF existing_count > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.eut_legacy_url_routes
      WHERE kind = 'candidate'
        AND slug = 'juciane-machado'
        AND source_key = 'wordpress_20261108'
        AND wp_post_id = 4415
        AND status = 'em_validacao'
    ) OR existing_count <> 1 THEN
      RAISE EXCEPTION 'Conflicting historical mapping detected; no changes applied';
    END IF;
  ELSE
    INSERT INTO public.eut_legacy_url_routes
      (kind, slug, source_key, wp_post_id, display_name, status)
    SELECT
      'candidate', slug, source_key, wp_post_id, title, 'em_validacao'
    FROM public.legacy_review_profiles
    WHERE kind = 'candidate'
      AND wp_post_id = 4415
      AND source_key = 'wordpress_20261108'
      AND slug = 'juciane-machado'
      AND source_status = 'publish'
      AND review_status = 'pending_review'
      AND demo_candidate IS FALSE;
  END IF;

  IF (SELECT count(*) FROM public.eut_legacy_url_routes
      WHERE kind = 'candidate'
      AND slug = 'juciane-machado'
      AND wp_post_id = 4415
      AND status = 'em_validacao') <> 1 THEN
    RAISE EXCEPTION 'Postcondition failed: expected exactly one unapproved public reference';
  END IF;
END;
$body$;

-- Verify zero demos were published and this is the only inserted mapping.
-- This read-only result is safe to inspect after controlled execution:
SELECT kind, slug, wp_post_id, status
FROM public.eut_legacy_url_routes
WHERE kind = 'candidate' AND slug = 'juciane-machado';

COMMIT;
