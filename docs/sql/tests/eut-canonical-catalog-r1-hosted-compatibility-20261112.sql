-- ONLY for ephemeral CI. Source: read-only pg_get_functiondef/pg_get_triggerdef.
-- Add production-like ownership FK + required stable public slug, omitted from
-- the shared synthetic fixture. Existing Auth identities and IDs remain intact.
CREATE SCHEMA eut_migration;
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id));
INSERT INTO public.profiles SELECT id FROM auth.users;
ALTER TABLE public.technicians DROP CONSTRAINT technicians_user_id_fkey;
ALTER TABLE public.technicians ADD CONSTRAINT technicians_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.technicians ADD COLUMN public_slug text;
CREATE OR REPLACE FUNCTION eut_migration.technician_public_slug_base(
 _name text,_city text,_uf text) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(nullif(trim(both '-' from left(
  regexp_replace(translate(lower(concat_ws('-',
   nullif(trim(_name),''),nullif(trim(_city),''),nullif(trim(_uf),''))),
   'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),
   '[^a-z0-9]+','-','g'),80)),''),'tecnico');
$$;
CREATE OR REPLACE FUNCTION eut_migration.assign_technician_public_slug()
 RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE base text;
BEGIN
 IF TG_OP='UPDATE' AND OLD.public_slug IS NOT NULL THEN
   NEW.public_slug:=OLD.public_slug; RETURN NEW;
 END IF;
 base:=eut_migration.technician_public_slug_base(NEW.display_name,NEW.city,NEW.state_uf);
 IF EXISTS(SELECT 1 FROM public.technicians t
     WHERE t.public_slug=base AND t.id<>NEW.id) THEN
   base:=left(base,80)||'-'||left(replace(NEW.id::text,'-',''),12);
 END IF;
 NEW.public_slug:=base; RETURN NEW;
END $$;
UPDATE public.technicians SET public_slug =
  eut_migration.technician_public_slug_base(display_name,city,state_uf)
  ||'-'||left(replace(id::text,'-',''),12);
ALTER TABLE public.technicians ALTER COLUMN public_slug SET NOT NULL;
ALTER TABLE public.technicians ADD CONSTRAINT eut_technicians_public_slug_format
 CHECK(public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(public_slug)<=96);
CREATE UNIQUE INDEX fx_public_slug_unique ON public.technicians(public_slug);
CREATE TRIGGER eut_assign_technician_public_slug
 BEFORE INSERT OR UPDATE OF public_slug,display_name,city,state_uf ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION eut_migration.assign_technician_public_slug();
