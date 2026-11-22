-- EUT #424. NOT A PRODUCTION MIGRATION. Draft for local ephemeral PostgreSQL only.
-- FAIL CLOSED by design: active definitions for two functions are not published.
-- Official Data API exposed-schemas configuration has NOT been proven.
\set ON_ERROR_STOP on
DO $eut424_blocker$
BEGIN
 RAISE EXCEPTION 'EUT424 NO-GO: exact active bodies of phone trigger and public IDs RPC missing; Data API exposure not proven';
END;
$eut424_blocker$;

-- Seven historical active-body hashes verified in Q1 vs versioned source:
-- public.eut_publish_my_technician: a17527fc0b4ddf81cd47df1a35f46c81 (reuse tests/profile-local/official-publish-rpc.sql #429)
-- public.eut_account_operational: d347337cb2a9359fb3ac3fe0a85ce52e (reuse tests/otp-local/bootstrap.sql #429)
-- eut_visibility.eut_public_technician_eligible: e873b8b24a23a3b221f883caba4fbcad
-- eut_moderation.reject_restricted_publication: 4514ae8535ea09092f65991d2c1eec84
-- eut_migration.technician_public_slug_base: c1c1f166c0078cf934fef9ecd03a9bb3
-- eut_migration.assign_technician_public_slug: c254a5da6ce1b97ed572dc0730caa8be
-- public.eut_validate_technician_city_and_coverage: fb69d2e8ace6c5149937cf6541594fac
-- BLOCKED: eut_moderation.reject_restricted_phone() active MD5 af0e1c0ae8a0d850ad6619b4b4242d79
-- BLOCKED: public.eut_public_eligible_technician_ids(uuid[]) active MD5 8e4e8f56ceb5bc3457164335722125f1
-- No historical substitute for either blocked function may ever be loaded.

-- All following statements are unreachable until a separately authorized gate removal:
ALTER TYPE public.approval_status ADD VALUE IF NOT EXISTS 'suspenso';
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS avatar_path text,
 ADD COLUMN IF NOT EXISTS service_radius_km integer,
 ADD COLUMN IF NOT EXISTS coverage_city_ids integer[] NOT NULL DEFAULT '{}'::integer[];
ALTER TABLE public.eut_technician_private_contacts
 ADD COLUMN IF NOT EXISTS allow_paid_contact boolean NOT NULL DEFAULT false;
CREATE SCHEMA IF NOT EXISTS eut_visibility;
REVOKE ALL ON SCHEMA eut_visibility FROM PUBLIC;
GRANT USAGE ON SCHEMA eut_visibility TO anon, authenticated;
CREATE TABLE IF NOT EXISTS public.eut_ibge_municipalities (
 id integer PRIMARY KEY CHECK (id BETWEEN 1000000 AND 9999999),
 name text NOT NULL, uf text NOT NULL,
 latitude double precision NOT NULL, longitude double precision NOT NULL
);
ALTER TABLE public.eut_ibge_municipalities ENABLE ROW LEVEL SECURITY;
CREATE POLICY eut_424_ibge_local_select ON public.eut_ibge_municipalities
 FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.eut_ibge_municipalities TO anon, authenticated;
-- IBGE test municipality still requires a separately approved verified synthetic seed.

-- Body verified against paid source; expected prosrc MD5 e873b8b24a23a3b221f883caba4fbcad
CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible(
  _technician_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.technicians t
  WHERE t.id=_technician_id
  AND t.status='aprovado'::public.approval_status
  AND t.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.eut_technician_private_contacts c
    WHERE c.user_id=t.user_id
      AND c.allow_paid_contact IS TRUE
      AND c.phone_e164 ~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'
  )
  AND NOT EXISTS (
    SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=t.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.eut_technician_private_contacts c
    JOIN eut_moderation.blocked_phones b
      ON b.phone_digits=pg_catalog.regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
    WHERE c.user_id=t.user_id AND c.phone_e164 IS NOT NULL
      AND pg_catalog.regexp_replace(c.phone_e164,'[^0-9]','','g')<>''
  )
 );
$function$;

-- Body verified against moderation source; expected prosrc MD5 4514ae8535ea09092f65991d2c1eec84
CREATE OR REPLACE FUNCTION eut_moderation.reject_restricted_publication()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $body$
begin
  if new.status = 'aprovado'::public.approval_status then
    if exists (select 1 from eut_moderation.blocked_accounts a where a.user_id=new.user_id)
      or exists (select 1 from public.eut_technician_private_contacts c
        join eut_moderation.blocked_phones b
          on b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
        where c.user_id=new.user_id)
    then
      raise exception 'Não foi possível concluir seu cadastro. Consulte o suporte.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$body$;

-- Body verified against slug source; expected prosrc MD5 c1c1f166c0078cf934fef9ecd03a9bb3
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

-- Body verified against slug source; expected prosrc MD5 c254a5da6ce1b97ed572dc0730caa8be
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

-- Body verified against city source; expected prosrc MD5 fb69d2e8ace6c5149937cf6541594fac
CREATE OR REPLACE FUNCTION public.eut_validate_technician_city_and_coverage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
DECLARE expected_id integer; canonical_name text; matched int;
BEGIN
 IF NEW.status = 'aprovado'::public.approval_status THEN
  SELECT m.id,m.name INTO expected_id,canonical_name FROM public.eut_ibge_municipalities m
   WHERE m.uf=NEW.state_uf AND lower(m.name)=lower(btrim(NEW.city))
   LIMIT 1;
  IF expected_id IS NULL THEN
   RAISE EXCEPTION 'Selecione um município válido do catálogo IBGE para a UF escolhida';
  END IF;
  -- Store the exact canonical city spelling, even when input casing differed.
  NEW.city := canonical_name;
  -- A base-city change invalidates any previously declared radius and list.
  -- Clear them, then the owner can confirm the new coverage explicitly.
  IF TG_OP = 'UPDATE' AND
    (OLD.city IS DISTINCT FROM NEW.city OR OLD.state_uf IS DISTINCT FROM NEW.state_uf) THEN
    NEW.coverage_city_ids := '{}'::integer[];
    NEW.service_radius_km := NULL;
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

CREATE UNIQUE INDEX IF NOT EXISTS eut_technicians_public_slug_unique ON public.technicians(public_slug);
CREATE TRIGGER eut_assign_technician_public_slug
 BEFORE INSERT OR UPDATE OF public_slug, display_name, city, state_uf
 ON public.technicians FOR EACH ROW EXECUTE FUNCTION eut_migration.assign_technician_public_slug();
CREATE TRIGGER eut_technician_city_coverage_guard
 BEFORE INSERT OR UPDATE OF city, state_uf, status, coverage_city_ids
 ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.eut_validate_technician_city_and_coverage();
CREATE TRIGGER eut_restrict_technician_publication
 BEFORE INSERT OR UPDATE OF status, user_id
 ON public.technicians FOR EACH ROW EXECUTE FUNCTION eut_moderation.reject_restricted_publication();
-- The private-contact trigger and public IDs RPC remain intentionally absent.
-- No public SELECT visibility policy, GoTrue QA, HTTP QA or Chromium QA may run without those exact bodies.
