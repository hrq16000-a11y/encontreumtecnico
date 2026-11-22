-- EUT #424: STRICTLY LOCAL, DISPOSABLE QA-A/QA-B planning fixture.
-- NEVER apply to the official Supabase project, staging or production.
-- This script is deliberately INEXECUTABLE until separate written approval.
-- Its first SQL statement fails before any DDL, seed, grant or policy.
-- Production Data API exposure of eut_visibility remains administratively UNVERIFIED.
-- Two active function bodies are intentionally NOT shipped to this public repository.
\set ON_ERROR_STOP on
DO $eut424_hold$
BEGIN
  RAISE EXCEPTION 'EUT424 BLOCKED: no QA execution approved; two active definitions and official Data API metadata pending'
    USING ERRCODE = 'P0001';
END;
$eut424_hold$;

-- Blocked requirements: the future isolated orchestrator must supply the two
-- exact active definitions by a privately controlled ephemeral mechanism;
-- it must NEVER log, commit or substitute historical bodies.
-- Source of truth: pg_proc.prosrc MD5, reconfirmed 2026-11-22.
-- eut_moderation.reject_restricted_phone(): af0e1c0ae8a0d850ad6619b4b4242d79
-- public.eut_public_eligible_technician_ids(uuid[]): 8e4e8f56ceb5bc3457164335722125f1
-- Separately verify official Data API exposed schemas do NOT include eut_visibility.
-- Database metadata and grants are NOT sufficient evidence of API non-exposure.
-- Approved #429 local GoTrue bootstrap sources must be fetched at its exact
-- versioned SHA; tests/profile-local/bootstrap.sql is NOT in PR #424 base.
-- The existing #429 functional QA is NOT to be re-run.
-- The next SQL blocks are unreachable until the explicit hold above is removed
-- in a future separately authorized implementation.

-- Seven equivalent versioned function bodies / reuse points (MD5 prosrc):
-- public.eut_publish_my_technician: a17527fc0b4ddf81cd47df1a35f46c81
-- public.eut_account_operational: d347337cb2a9359fb3ac3fe0a85ce52e
-- eut_visibility.eut_public_technician_eligible: e873b8b24a23a3b221f883caba4fbcad
-- eut_moderation.reject_restricted_publication: 4514ae8535ea09092f65991d2c1eec84
-- eut_migration.technician_public_slug_base: c1c1f166c0078cf934fef9ecd03a9bb3
-- eut_migration.assign_technician_public_slug: c254a5da6ce1b97ed572dc0730caa8be
-- public.eut_validate_technician_city_and_coverage: fb69d2e8ace6c5149937cf6541594fac

-- Local schema DELTA only; never replace the #429 approved bootstrap.
-- Requirement: start with #429 tests/otp-local/bootstrap.sql and
-- tests/profile-local/bootstrap.sql, both at their known approved blobs.
-- Approval status enum already exists in the historical schema.
ALTER TYPE public.approval_status ADD VALUE IF NOT EXISTS 'suspenso';

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS state_uf text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS service_slugs text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS service_radius_km integer,
  ADD COLUMN IF NOT EXISTS coverage_city_ids integer[] NOT NULL DEFAULT '{}'::integer[];

ALTER TABLE public.eut_technician_private_contacts
  ADD COLUMN IF NOT EXISTS allow_paid_contact boolean NOT NULL DEFAULT false;

CREATE SCHEMA IF NOT EXISTS eut_visibility;
REVOKE ALL ON SCHEMA eut_visibility FROM PUBLIC;
GRANT USAGE ON SCHEMA eut_visibility TO anon, authenticated;
-- Do NOT add eut_visibility to PostgREST's exposed schemas.

-- Verified IBGE locality; this is only a SYNTHETIC local fixture record.
-- Coordinates are coarse, used solely to populate the local catalog.
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
CREATE POLICY eut_ibge_municipalities_public_select
  ON public.eut_ibge_municipalities
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON TABLE public.eut_ibge_municipalities
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eut_ibge_municipalities TO anon, authenticated;
INSERT INTO public.eut_ibge_municipalities(id, name, uf, latitude, longitude)
  VALUES (4106902, 'Curitiba', 'PR', -25.43, -49.27);
-- No identity, phone, account, technician or private contact seed here.

-- Officially versioned constraints, local only and additive.
DO $eut424_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.technicians'::pg_catalog.regclass
      AND conname = 'eut_technician_radius_safe'
  ) THEN
    ALTER TABLE public.technicians
      ADD CONSTRAINT eut_technician_radius_safe CHECK (
        service_radius_km IS NULL OR
        service_radius_km IN (5,10,20,30,50,75,100,150,200,300)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.technicians'::pg_catalog.regclass
      AND conname = 'eut_technician_coverage_max_five'
  ) THEN
    ALTER TABLE public.technicians
      ADD CONSTRAINT eut_technician_coverage_max_five
        CHECK (pg_catalog.cardinality(coverage_city_ids) <= 5);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.technicians'::pg_catalog.regclass
      AND conname = 'eut_technician_avatar_path_format'
  ) THEN
    ALTER TABLE public.technicians
      ADD CONSTRAINT eut_technician_avatar_path_format CHECK (
        avatar_path IS NULL OR
        avatar_path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$'
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.technicians'::pg_catalog.regclass
      AND conname = 'eut_technicians_public_slug_format'
  ) THEN
    ALTER TABLE public.technicians
      ADD CONSTRAINT eut_technicians_public_slug_format CHECK (
        public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        AND pg_catalog.length(public_slug) <= 96
      );
  END IF;
END;
$eut424_constraints$;

-- Below: five exact function bodies from existing PUBLIC versioned references,
-- not the two private active definitions which remain prohibited.
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

-- Metadata gate (local pg_catalog only) for TWO separately injected active bodies.
-- Re-run must be explicitly authorized; no fallback to historical functions.
-- These checks remain UNREACHABLE behind the initial unconditional blocker.
DO $eut424_hash_gate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = pg_catalog.to_regprocedure('eut_moderation.reject_restricted_phone()')
      AND pg_catalog.md5(p.prosrc) = 'af0e1c0ae8a0d850ad6619b4b4242d79'
      AND p.prosecdef = true
      AND p.provolatile = 'v'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      AND 'search_path=pg_catalog' = ANY(p.proconfig)
  ) THEN
    RAISE EXCEPTION 'EUT424 NO-GO: active restricted-phone function missing or drifted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid = pg_catalog.to_regprocedure('public.eut_public_eligible_technician_ids(uuid[])')
      AND pg_catalog.md5(p.prosrc) = '8e4e8f56ceb5bc3457164335722125f1'
      AND p.prosecdef = false
      AND p.provolatile = 's'
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      AND 'search_path=pg_catalog' = ANY(p.proconfig)
  ) THEN
    RAISE EXCEPTION 'EUT424 NO-GO: active public eligibility RPC missing or drifted';
  END IF;
END;
$eut424_hash_gate$;

-- Restrictive RLS guard clauses mirror the reviewed historical migration.
-- Never grant direct access to blocked accounts, phone lists or contact tables.
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY eut_public_visibility_anon_guard
  ON public.technicians AS RESTRICTIVE FOR SELECT TO anon
  USING (
    status = 'aprovado'::public.approval_status
    AND eut_visibility.eut_public_technician_eligible(id)
  );
CREATE POLICY eut_public_visibility_auth_guard
  ON public.technicians AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    eut_visibility.eut_public_technician_eligible(id)
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
REVOKE ALL ON TABLE
  public.eut_technician_private_contacts,
  eut_moderation.blocked_accounts,
  eut_moderation.blocked_phones
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.eut_technician_private_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_phones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION eut_visibility.eut_public_technician_eligible(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION eut_visibility.eut_public_technician_eligible(uuid)
  TO anon, authenticated;
REVOKE ALL ON FUNCTION public.eut_public_eligible_technician_ids(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_eligible_technician_ids(uuid[])
  TO anon, authenticated;
REVOKE ALL ON FUNCTION eut_moderation.reject_restricted_phone()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eut_moderation.reject_restricted_publication()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eut_migration.technician_public_slug_base(text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eut_migration.assign_technician_public_slug()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eut_validate_technician_city_and_coverage()
  FROM PUBLIC, anon, authenticated;

-- Slug trigger and integrity; installed only in a private local future run.
CREATE UNIQUE INDEX IF NOT EXISTS eut_technicians_public_slug_unique
  ON public.technicians(public_slug);
CREATE TRIGGER eut_assign_technician_public_slug
  BEFORE INSERT OR UPDATE OF public_slug, display_name, city, state_uf
  ON public.technicians FOR EACH ROW
  EXECUTE FUNCTION eut_migration.assign_technician_public_slug();
CREATE TRIGGER eut_technician_city_coverage_guard
  BEFORE INSERT OR UPDATE OF city, state_uf, status, coverage_city_ids
  ON public.technicians FOR EACH ROW
  EXECUTE FUNCTION public.eut_validate_technician_city_and_coverage();
CREATE TRIGGER eut_restrict_technician_publication
  BEFORE INSERT OR UPDATE OF status, user_id
  ON public.technicians FOR EACH ROW
  EXECUTE FUNCTION eut_moderation.reject_restricted_publication();
CREATE TRIGGER eut_restrict_private_contact
  BEFORE INSERT OR UPDATE OF phone_e164, allow_paid_contact
  ON public.eut_technician_private_contacts FOR EACH ROW
  EXECUTE FUNCTION eut_moderation.reject_restricted_phone();

-- Do NOT infer the official Data API configuration from local grants.
-- Server/client localhost isolation, exact private body injection and
-- proof that eut_visibility is NOT exposed are still mandatory separate gates.
-- Other local #429 baseline policies, login and publication must be preserved.
-- DO NOT remove the first unconditional blocker in this micro-round.
