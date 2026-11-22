-- PROPOSAL ONLY. Do not run on the hosted Encontre um Técnico Supabase project.
-- Source: 2026-11-22 metadata preflight, public.legacy_public_archive (relkind 'r').
-- This file is NOT a migration and must not be applied before isolated PostgreSQL
-- QA, a checked Data API exposed-schema list, and explicit release authorization.
-- Phase A only: additive RPC. Do not revoke table SELECT in this file.
-- The public table and every existing row, grant, policy, trigger and RLS setting
-- remain untouched. Revoke direct SELECT only after BOTH consumers migrate.
--
-- Security contract:
-- * No raw display_name or unsanitized category tag may leave the RPC.
-- * Same explicit eligibility guard as "Published WordPress archive read-only".
-- * The PUBLIC wrapper uses SECURITY DEFINER solely for this bounded projection;
--   every referenced object is schema-qualified and search_path is pg_catalog.
-- * The internal schema must NOT be exposed through Supabase Data API.
-- * The installer must own both functions and must be allowed to read the table.
-- * Any name/contact false negative remains a release blocker; test with synthetic
--   fixtures and inspect only metadata before production authorization.

BEGIN;

-- Fail closed on a name collision; NEVER reuse an unknown private schema.
CREATE SCHEMA eut_legacy_internal;
REVOKE ALL ON SCHEMA eut_legacy_internal FROM PUBLIC, anon, authenticated;

CREATE FUNCTION eut_legacy_internal.public_legacy_name(_raw text)
RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path TO pg_catalog
AS $safe_name$
  SELECT CASE
    WHEN _raw IS NULL OR pg_catalog.btrim(_raw) = ''
      OR pg_catalog.strpos(_raw, '@') > 0
      OR _raw ~* '(https?://|www[.]|wa[.]me/|t[.]me/)'
      OR _raw ~* '(\+?[0-9]([[:space:]()./-]*[0-9]){7,})'
      OR _raw ~* '(^|[^[:alpha:]])(whats(app)?|telefone|tel[.]?|celular|contato|instagram|telegram|facebook)([^[:alpha:]]|$)'
      OR _raw ~* '([[:alnum:]_-]+[.](com([.]br)?|net([.]br)?|org([.]br)?|br|io|app|dev|info|site|online|me|co))([^[:alpha:]]|$)'
    THEN 'Técnico'
    ELSE pg_catalog.btrim(_raw)
  END;
$safe_name$;

-- Keep the sanitizer inaccessible to direct public calls.
REVOKE ALL ON FUNCTION eut_legacy_internal.public_legacy_name(text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.eut_public_legacy_archive_page(
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $page$
DECLARE
  result jsonb;
BEGIN
  IF _limit IS NULL OR _limit < 1 OR _limit > 24
     OR _offset IS NULL OR _offset < 0 OR _offset > 24000 THEN
    RAISE EXCEPTION 'invalid public archive pagination' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'profiles', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'wp_post_id', page.wp_post_id,
          'display_name', eut_legacy_internal.public_legacy_name(page.display_name),
          'sector_tags', (
            SELECT COALESCE(pg_catalog.array_agg(tagged.value ORDER BY tagged.ord), ARRAY[]::text[])
            FROM (
              SELECT pg_catalog.btrim(raw.tag) AS value, raw.ord
              FROM pg_catalog.unnest(page.sector_tags) WITH ORDINALITY AS raw(tag, ord)
              WHERE raw.tag IS NOT NULL
            ) AS tagged
            WHERE pg_catalog.char_length(tagged.value) BETWEEN 1 AND 80
              AND eut_legacy_internal.public_legacy_name(tagged.value) = tagged.value
          ),
          'country_label', 'Brasil',
          'validation_status', 'em_validacao'
        )
        ORDER BY page.wp_post_id
      )
      FROM (
        SELECT a.wp_post_id, a.display_name, a.sector_tags
        FROM public.legacy_public_archive AS a
        WHERE a.validation_status = 'em_validacao'
          AND a.contact_enabled IS FALSE
          AND a.city_confirmed IS FALSE
        ORDER BY a.wp_post_id ASC
        LIMIT _limit OFFSET _offset
      ) AS page
    ), '[]'::jsonb),
    'count', (
      SELECT pg_catalog.count(*)
      FROM public.legacy_public_archive AS a
      WHERE a.validation_status = 'em_validacao'
        AND a.contact_enabled IS FALSE
        AND a.city_confirmed IS FALSE
    )
  ) INTO result;
  RETURN result;
END;
$page$;

-- Function EXECUTE defaults to PUBLIC; revoke and grant atomically.
REVOKE ALL ON FUNCTION public.eut_public_legacy_archive_page(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_legacy_archive_page(integer, integer)
  TO anon, authenticated;

COMMIT;

-- Phase B: requires SEPARATE authorization after both /tecnicos and LP2
-- consume only the sanitized RPC and isolated QA passes. NOT included here:
--   REVOKE SELECT ON TABLE public.legacy_public_archive FROM anon, authenticated;
-- Check all applicable grants, inherited roles, and column permissions first.
-- Fail closed when RPC unavailable; NEVER re-enable unfiltered public SELECT
-- as an automatic rollback. For a failed rollout, restore the RPC-based
-- frontend and fix the RPC under separately approved release procedures.
