-- EUT 2026-11-10: municipality catalog, owner-declared service territory,
-- and optional explicitly public technician avatar. Apply after importing
-- the 5571 city snapshot from data/municipios-ibge-20261110.csv.
-- Source: IBGE municipality identifiers; city centroids are municipal reference
-- points, NOT a precise address, road distance, legal boundary or travel ETA.
BEGIN;

CREATE TABLE IF NOT EXISTS public.eut_ibge_municipalities (
 id integer PRIMARY KEY CHECK (id BETWEEN 1000000 AND 9999999),
 name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
 uf text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
 latitude double precision NOT NULL CHECK (latitude BETWEEN -35 AND 6),
 longitude double precision NOT NULL CHECK (longitude BETWEEN -75 AND -30)
);
CREATE INDEX IF NOT EXISTS eut_ibge_municipalities_uf_name_idx
  ON public.eut_ibge_municipalities(uf, name);
ALTER TABLE public.eut_ibge_municipalities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eut_ibge_municipalities_public_select ON public.eut_ibge_municipalities;
CREATE POLICY eut_ibge_municipalities_public_select
 ON public.eut_ibge_municipalities FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON TABLE public.eut_ibge_municipalities FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eut_ibge_municipalities TO anon, authenticated;

ALTER TABLE public.technicians
 ADD COLUMN IF NOT EXISTS service_radius_km integer,
 ADD COLUMN IF NOT EXISTS coverage_city_ids integer[] NOT NULL DEFAULT '{}'::integer[],
 ADD COLUMN IF NOT EXISTS avatar_path text;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.technicians'::regclass
   AND conname='eut_technician_radius_safe') THEN
  ALTER TABLE public.technicians ADD CONSTRAINT eut_technician_radius_safe
   CHECK (service_radius_km IS NULL OR service_radius_km IN (5,10,20,30,50,75,100,150,200,300));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.technicians'::regclass
   AND conname='eut_technician_coverage_max_five') THEN
  ALTER TABLE public.technicians ADD CONSTRAINT eut_technician_coverage_max_five
   CHECK (cardinality(coverage_city_ids) <= 5);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.technicians'::regclass
   AND conname='eut_technician_avatar_path_format') THEN
  ALTER TABLE public.technicians ADD CONSTRAINT eut_technician_avatar_path_format
   CHECK (avatar_path IS NULL OR avatar_path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$');
 END IF;
END $$;

-- The existing publish RPC already checks account, role, category, service and
-- anti-suspension constraints. Its base-city values are now checked by the DB.
-- Only approved profiles must have a canonical municipality; existing drafts
-- retain historic unverified city text until their next publish.
CREATE OR REPLACE FUNCTION public.eut_validate_technician_city_and_coverage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
DECLARE expected_id integer; matched int;
BEGIN
 IF NEW.status = 'aprovado'::public.approval_status THEN
  SELECT m.id INTO expected_id FROM public.eut_ibge_municipalities m
   WHERE m.uf=NEW.state_uf AND lower(m.name)=lower(btrim(NEW.city))
   LIMIT 1;
  IF expected_id IS NULL THEN
   RAISE EXCEPTION 'Selecione um município válido do catálogo IBGE para a UF escolhida';
  END IF;
 END IF;
 IF cardinality(NEW.coverage_city_ids)>0 THEN
  IF NEW.status <> 'aprovado'::public.approval_status THEN
   RAISE EXCEPTION 'Coverage may only be declared on a published technician profile';
  END IF;
  SELECT count(DISTINCT m.id)::int INTO matched
    FROM public.eut_ibge_municipalities m
    WHERE m.id=ANY(NEW.coverage_city_ids);
  IF matched <> cardinality(NEW.coverage_city_ids) THEN
    RAISE EXCEPTION 'Cidades de atendimento devem ser únicas e válidas no IBGE';
  END IF;
  IF NOT expected_id=ANY(NEW.coverage_city_ids) THEN
    RAISE EXCEPTION 'A cidade-base precisa constar entre as até cinco cidades declaradas';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS eut_technician_city_coverage_guard ON public.technicians;
CREATE TRIGGER eut_technician_city_coverage_guard
 BEFORE INSERT OR UPDATE OF city,state_uf,status,coverage_city_ids
 ON public.technicians FOR EACH ROW
 EXECUTE FUNCTION public.eut_validate_technician_city_and_coverage();

-- RPC owner-only: no client-supplied user ID; preserves approval and every
-- existing identity, contact, service/category and referral field.
CREATE OR REPLACE FUNCTION public.eut_set_my_technician_coverage(
 _radius_km integer, _city_ids integer[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid; v_codes integer[]; n integer;
BEGIN
 IF v_uid IS NULL OR eut_migration.confirmed_current_email() IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.user_roles r
     WHERE r.user_id=v_uid AND r.role='tecnico'::public.app_role)
 THEN RAISE EXCEPTION 'verified technician account required'; END IF;
 IF _radius_km IS NOT NULL AND _radius_km NOT IN (5,10,20,30,50,75,100,150,200,300)
 THEN RAISE EXCEPTION 'invalid service radius'; END IF;
 v_codes:=coalesce(_city_ids,'{}'::integer[]);
 n:=cardinality(v_codes);
 IF n<1 OR n>5 OR array_position(v_codes,NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'select between one and five validated municipalities'; END IF;
 UPDATE public.technicians t
 SET coverage_city_ids=v_codes, service_radius_km=_radius_km, updated_at=now()
 WHERE t.user_id=v_uid AND t.status='aprovado'::public.approval_status
 RETURNING t.id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'published profile required'; END IF;
 RETURN pg_catalog.jsonb_build_object('state','salvo','technician_id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.eut_set_my_technician_coverage(integer,integer[])
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_set_my_technician_coverage(integer,integer[])
 TO authenticated;

-- Public media is opt-in only. No historic WordPress portraits are imported by
-- guessed name/phone or downloaded from a private archive.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('eut-technician-avatars','eut-technician-avatars',true,2097152,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS eut_technician_avatar_owner_insert ON storage.objects;
CREATE POLICY eut_technician_avatar_owner_insert ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK (
  bucket_id='eut-technician-avatars'
  AND name ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$'
  AND split_part(name,'/',2)=(SELECT auth.uid()::text)
  AND EXISTS (SELECT 1 FROM public.user_roles r
    WHERE r.user_id=(SELECT auth.uid()) AND r.role='tecnico'::public.app_role)
 );
DROP POLICY IF EXISTS eut_technician_avatar_owner_delete ON storage.objects;
CREATE POLICY eut_technician_avatar_owner_delete ON storage.objects
 FOR DELETE TO authenticated USING (
  bucket_id='eut-technician-avatars'
  AND split_part(name,'/',2)=(SELECT auth.uid()::text)
 );
-- No UPDATE grant, no overwrite and no anonymous upload.
CREATE OR REPLACE FUNCTION public.eut_set_my_technician_avatar(_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid;
BEGIN
 IF v_uid IS NULL OR eut_migration.confirmed_current_email() IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=v_uid
     AND r.role='tecnico'::public.app_role)
 THEN RAISE EXCEPTION 'verified technician account required'; END IF;
 IF _path IS NOT NULL AND (
  _path !~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$'
  OR split_part(_path,'/',2)<>v_uid::text
  OR NOT EXISTS (SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='eut-technician-avatars' AND o.name=_path)
 ) THEN RAISE EXCEPTION 'avatar must be an uploaded image owned by the current technician'; END IF;
 UPDATE public.technicians t SET avatar_path=_path, updated_at=now()
  WHERE t.user_id=v_uid AND t.status='aprovado'::public.approval_status
  RETURNING t.id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'published profile required'; END IF;
 RETURN pg_catalog.jsonb_build_object('state','salvo');
END; $$;
REVOKE ALL ON FUNCTION public.eut_set_my_technician_avatar(text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_set_my_technician_avatar(text) TO authenticated;
COMMIT;
