-- EUT: migration 2026-11-10; technician URLs without internal UUIDs.
-- Safe on existing public profiles. Does not publish historical/draft profiles,
-- touch contact data, change payments or grant new read privileges.
BEGIN;

ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS public_slug text;

CREATE OR REPLACE FUNCTION eut_migration.technician_public_slug_base(
  _name text, _city text, _uf text
) RETURNS text
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT coalesce(nullif(trim(both '-' from left(
    regexp_replace(
      translate(
        lower(concat_ws('-', nullif(trim(_name), ''), nullif(trim(_city), ''), nullif(trim(_uf), ''))),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    ), 80
  )), ''), 'tecnico');
$$;

CREATE OR REPLACE FUNCTION eut_migration.assign_technician_public_slug()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE base text;
BEGIN
  -- A slug belongs to the profile, not the current owner-entered name/city.
  -- Later profile edits and user-supplied slug changes must never change links.
  IF TG_OP = 'UPDATE' AND OLD.public_slug IS NOT NULL THEN
    NEW.public_slug := OLD.public_slug;
    RETURN NEW;
  END IF;
  base := eut_migration.technician_public_slug_base(NEW.display_name, NEW.city, NEW.state_uf);
  -- Resolve duplicate names and locations; never disclose owner email/phone.
  IF EXISTS (
    SELECT 1 FROM public.technicians AS t
    WHERE t.public_slug = base AND t.id <> NEW.id
  ) THEN
    base := left(base, 80) || '-' || left(replace(NEW.id::text, '-', ''), 12);
  END IF;
  NEW.public_slug := base;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS eut_assign_technician_public_slug ON public.technicians;
CREATE TRIGGER eut_assign_technician_public_slug
  BEFORE INSERT OR UPDATE OF public_slug, display_name, city, state_uf
  ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION eut_migration.assign_technician_public_slug();

-- Backfill every existing profile (including unpublished) without modifying
-- status, contact, identities or service categories.
UPDATE public.technicians SET public_slug = NULL WHERE public_slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS eut_technicians_public_slug_unique
  ON public.technicians (public_slug);
ALTER TABLE public.technicians ALTER COLUMN public_slug SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.technicians'::regclass
      AND conname = 'eut_technicians_public_slug_format'
  ) THEN
    ALTER TABLE public.technicians
      ADD CONSTRAINT eut_technicians_public_slug_format
      CHECK (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        AND length(public_slug) <= 96);
  END IF;
END $$;

REVOKE ALL ON FUNCTION eut_migration.technician_public_slug_base(text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eut_migration.assign_technician_public_slug()
  FROM PUBLIC, anon, authenticated;
COMMIT;

-- Read-only postconditions to run after the transaction:
-- SELECT public_slug, id, status FROM public.technicians;
-- SELECT count(*) FROM public.technicians WHERE public_slug IS NULL;
